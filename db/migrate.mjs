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
  // The market registry, moved off disk.
  //
  // It used to be markets.json, read with readFileSync from the deployment bundle -- so
  // creating a market meant a git push and a full redeploy before production could see it.
  // The chain cannot supply the list on its own (ShieldedPool has a `marketVault[id]` mapping,
  // no array) and this project refuses to build on eth_getLogs against a 100-block cap, so
  // something off-chain has to hold it. A table is that something, and it is visible the
  // moment a row lands.
  //
  // Still only a CACHE OF IDS AND LABELS. Betting window, outcome and settled totals are
  // re-read from chain on every request in markets.ts, exactly as before, so a wrong row can
  // list or omit a market but never misstate one. `vault` is safe to store because
  // `marketVault[id]` is write-once on chain -- registerEncryptedMarket reverts with
  // MarketAlreadyRegistered if the id is taken, so the address can never change under us.
  //
  // Keyed by (pool, id): markets belong to a pool, and this deployment has already orphaned
  // several pools. The old file had one top-level `pool` field and would happily have served
  // a previous pool's markets against a new one.
  `CREATE TABLE IF NOT EXISTS markets (
    pool text NOT NULL,
    id integer NOT NULL,
    question text NOT NULL,
    category text NOT NULL,
    resolver_type text NOT NULL,
    vault text NOT NULL,
    resolver text NOT NULL,
    betting_close_time bigint NOT NULL,
    resolution_start_time bigint NOT NULL,
    created_at bigint NOT NULL,
    spec jsonb,
    PRIMARY KEY (pool, id)
  )`,
  // Client-side note vaults. `blob` is AES-GCM ciphertext the browser produced under a key
  // derived from a wallet signature (lib/atrum/client/vault.ts) -- this server cannot read it
  // and must never be able to. It exists only so notes survive a cleared browser and follow
  // the user across devices, which is what the plaintext `notes` table above bought at the
  // cost of handing the operator every spending secret.
  //
  // `notes` is deliberately left in place: the server-proving path still uses it, and dropping
  // a table that holds the only copy of live note secrets would burn real testnet positions.
  `CREATE TABLE IF NOT EXISTS note_vaults (
    owner text PRIMARY KEY,
    blob text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
];

for (const sql of STATEMENTS) {
  await pool.query(sql);
  console.log(`ok: ${sql.split("\n")[0].trim()}`);
}

await pool.end();
console.log("\nmigration complete");
