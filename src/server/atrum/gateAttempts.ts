import { db } from "./db";

/**
 * Rate limit for POST /api/atrum/gate, the one route here an outside attacker
 * can hit directly, unauthenticated, as many times as they like. Access-code
 * entropy (80 bits, see atrum-landing/src/lib/waitlist.ts) is the actual
 * defense against brute force; this only guards against casual scripted
 * guessing and keeps gate_attempts from growing unbounded under one.
 *
 * x-forwarded-for's first hop is spoofable, but it's the standard best-effort
 * signal on Vercel-style deployments and matches the effort level of
 * everything else here -- no new infra (Redis etc.) for a testnet soft gate.
 */
const WINDOW_MINUTES = 10;
const MAX_ATTEMPTS = 8;

export async function checkAndRecordAttempt(ip: string): Promise<boolean> {
  const { rows } = await db().query<{ count: string }>(
    `SELECT count(*)::text AS count FROM gate_attempts
     WHERE ip = $1 AND created_at > now() - ($2 || ' minutes')::interval`,
    [ip, WINDOW_MINUTES]
  );
  if (Number(rows[0]?.count ?? 0) >= MAX_ATTEMPTS) return false;

  await db().query(`INSERT INTO gate_attempts (ip) VALUES ($1)`, [ip]);
  return true;
}
