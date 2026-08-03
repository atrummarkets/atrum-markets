import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { verifyMessage, getAddress } from "viem";

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

export function newNonce(): string {
  return randomBytes(16).toString("hex");
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
 * The nonce is echoed back by the client rather than tracked server-side. That is a deliberate
 * simplification with a real limit: it does not prevent replay of a signature the user already
 * produced. For a testnet deployment where a session grants access only to notes the signer
 * already owns, that is an acceptable trade; a production build needs server-issued,
 * single-use nonces.
 */
export async function signIn(address: string, nonce: string, signature: `0x${string}`): Promise<string> {
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
