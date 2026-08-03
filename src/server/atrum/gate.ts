import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Testnet access gate.
 *
 * Separate from the wallet session in ./auth.ts on purpose: this cookie answers
 * "did this browser present a valid waitlist access code", not "which address is this" --
 * so the payload carries no identity, just a flag and an expiry. Signed, not encrypted,
 * same reasoning as the session cookie: the holder already knows what it says, the HMAC
 * just stops it being forged.
 *
 * verifyGateToken is kept pure (no next/headers import) so proxy.ts -- which runs ahead
 * of every request -- can call it directly without pulling in cookie-mutation APIs that
 * are only valid inside a Route Handler.
 */
const GATE_COOKIE = "atrum_gate";
const GATE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const GRANTED = "granted";

function secret(): Buffer {
  const s = process.env.GATE_SECRET;
  if (!s) throw new Error("missing required env var GATE_SECRET");
  return Buffer.from(s, "utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function mint(): string {
  const payload = `${GRANTED}.${Date.now() + GATE_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyGateToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [flag, expiry, mac] = parts;
  if (flag !== GRANTED) return false;
  const payload = `${flag}.${expiry}`;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  if (Number(expiry) < Date.now()) return false;
  return true;
}

/** Call only from a Route Handler after a valid access code has been confirmed. */
export async function grantGate(): Promise<void> {
  const jar = await cookies();
  jar.set(GATE_COOKIE, mint(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GATE_TTL_MS / 1000,
  });
}

export { GATE_COOKIE };
