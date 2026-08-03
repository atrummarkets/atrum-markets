#!/usr/bin/env node
/**
 * Creates the tables noteStore.ts and auth.ts need. Idempotent (IF NOT EXISTS everywhere) so
 * it's safe to re-run against an already-migrated database.
 *
 * Run once against DATABASE_URL before first use: `npm run db:migrate`.
 */
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("error: missing DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS notes (
    id text PRIMARY KEY,
    owner text NOT NULL,
    commitment text NOT NULL,
    nullifier text NOT NULL,
    secret text NOT NULL,
    market_id text NOT NULL,
    outcome integer NOT NULL,
    units text NOT NULL,
    status text NOT NULL,
    label text NOT NULL,
    created_at bigint NOT NULL,
    tx_hash text
  )`,
  `CREATE INDEX IF NOT EXISTS notes_owner_idx ON notes (owner)`,
  // Single-use sign-in nonces. Closes the replay gap HANDOFF.md/README.md both name: nonces
  // used to be echoed back by the client and trusted, so a signature already produced could
  // be replayed against auth/verify indefinitely. Issuance inserts a row; verify requires
  // `used = false` and flips it in the same transaction.
  `CREATE TABLE IF NOT EXISTS auth_nonces (
    nonce text PRIMARY KEY,
    address text,
    used boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  // Rate limit on POST /api/atrum/gate -- the one route in this app an outside
  // attacker can hit directly, unauthenticated, as many times as they like.
  // Access-code entropy is the primary defense; this is defense-in-depth
  // against casual scripted guessing, per gateAttempts.ts.
  `CREATE TABLE IF NOT EXISTS gate_attempts (
    id bigserial PRIMARY KEY,
    ip text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS gate_attempts_ip_created_idx ON gate_attempts (ip, created_at)`,
];

for (const sql of STATEMENTS) {
  await pool.query(sql);
  console.log(`ok: ${sql.split("\n")[0].trim()}`);
}

await pool.end();
console.log("\nmigration complete");
