import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { verifyMessage, getAddress } from "viem";
import { db } from "./db";
import { operatorAddress } from "./chain";

/**
 * Signature-based sessions.
 *
 * Notes are keyed by owner address and their secrets are spendable, so "which address are
 * you?" has to be PROVED, not asserted -- otherwise anyone could name someone else's address
 * and drain them. The user signs a nonce with their wallet; the server verifies the signature
 * recovers to that address and issues an HMAC-signed cookie.
 *
 * The cookie is signed, not encrypted: it carries only an address and an expiry, both of which
 * the holder already knows. What matters is that it cannot be FORGED, which the HMAC gives.
 */
const SESSION_COOKIE = "atrum_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Fails loudly rather than defaulting. A dev-friendly fallback secret is exactly how a
 * forgeable session cookie reaches production, and the failure would be silent.
 */
function secret(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("missing required env var SESSION_SECRET");
  return Buffer.from(s, "utf8");
}

export function nonceMessage(nonce: string): string {
  return [
    "Sign in to Atrum.",
    "",
    "This proves you control this address. It is not a transaction and costs nothing.",
    "",
    `Nonce: ${nonce}`,
  ].join("\n");
}

/** Issues a nonce and records it as unused, so it can only ever be redeemed once. */
export async function newNonce(): Promise<string> {
  const nonce = randomBytes(16).toString("hex");
  await db().query("INSERT INTO auth_nonces (nonce) VALUES ($1)", [nonce]);
  return nonce;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function mint(address: string): string {
  const payload = `${address.toLowerCase()}.${Date.now() + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

function verify(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [address, expiry, mac] = parts;
  const payload = `${address}.${expiry}`;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  // Constant-time: a length-varying or short-circuiting compare on a MAC is a forgery oracle.
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expiry) < Date.now()) return null;
  return address;
}

/**
 * Verify a wallet signature over our nonce and issue a session.
 *
 * The nonce is server-issued and single-use: `newNonce` records it unused, and this consumes
 * it atomically (the UPDATE only affects a row that is still unused) before checking the
 * signature. A previously-used nonce is rejected up front, which is what stops a signature the
 * user already produced from being replayed.
 */
export async function signIn(address: string, nonce: string, signature: `0x${string}`): Promise<string> {
  const { rowCount } = await db().query(
    "UPDATE auth_nonces SET used = true, address = $2 WHERE nonce = $1 AND used = false",
    [nonce, address.toLowerCase()],
  );
  if (rowCount === 0) throw new Error("nonce is unknown or already used");

  const checksummed = getAddress(address);
  const ok = await verifyMessage({ address: checksummed, message: nonceMessage(nonce), signature });
  if (!ok) throw new Error("signature does not match that address");

  const jar = await cookies();
  jar.set(SESSION_COOKIE, mint(checksummed), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return checksummed;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** The signed-in address, or null. */
export async function currentUser(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verify(token);
}

/** The signed-in address, or throw. Use in every route that touches notes. */
export async function requireUser(): Promise<string> {
  const user = await currentUser();
  if (!user) throw new Error("not signed in -- connect your wallet");
  return user;
}

/**
 * The signed-in address, and it must be the operator's.
 *
 * WHAT THIS CLOSES. `/api/atrum/admin/resolve` and `/api/atrum/admin/settle` had no auth at
 * all. This server holds the resolver key -- on every manual-resolver market `Vault.resolver`
 * IS the operator EOA -- so an unauthenticated resolve endpoint let anyone on the internet
 * choose the outcome of any unresolved market, then redeem against the side they chose. The
 * testnet access gate hid it; removing that gate exposed it.
 *
 * Gated on the session address rather than a shared secret because the admin panel runs in a
 * browser. A secret the browser must hold to call the endpoint is a secret the browser hands
 * to anyone who opens devtools, which is not a gate.
 *
 * `operatorAddress` is derived from the same `PRIVATE_KEY` that signs the resolve, so this
 * cannot drift out of agreement with who is actually authorised on chain.
 */
export async function requireOperator(): Promise<string> {
  const user = await requireUser();
  if (user.toLowerCase() !== operatorAddress.toLowerCase()) {
    throw new Error("not authorised -- this action is operator-only");
  }
  return user;
}
