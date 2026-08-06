#!/usr/bin/env node
/**
 * One-time import of markets.json into the `markets` table.
 *
 * The file was the registry until markets moved into Postgres. Everything in it is still live
 * on chain, so it has to come across or the app would list nothing until each market was
 * recreated -- which is impossible, since `registerEncryptedMarket` reverts on an id that is
 * already taken.
 *
 * Idempotent: `upsertMarket`'s ON CONFLICT means re-running only refreshes labels. Safe to run
 * before or after the app is deployed, because `loadRegistry` falls back to the file until the
 * table has rows for the current pool.
 *
 * Usage: node --env-file=.env.local db/import-markets.mjs [--dry-run]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const DRY_RUN = process.argv.includes("--dry-run");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("error: missing DATABASE_URL");
  process.exit(1);
}

const registry = JSON.parse(readFileSync(join(process.cwd(), "markets.json"), "utf8"));

// The pool the file was written for -- NOT whatever POOL_ADDRESS currently says. Importing a
// dead pool's markets under a live pool's key would list markets whose vaults the live pool
// has never heard of, and every read against them would fail on chain.
const pool = String(registry.pool).toLowerCase();
if (!/^0x[0-9a-f]{40}$/.test(pool)) {
  console.error(`error: markets.json has no usable top-level pool address (got ${registry.pool})`);
  process.exit(1);
}

if (process.env.POOL_ADDRESS && process.env.POOL_ADDRESS.toLowerCase() !== pool) {
  console.warn(
    `warning: markets.json is for pool ${pool}, but POOL_ADDRESS is ${process.env.POOL_ADDRESS.toLowerCase()}.\n` +
      "         Importing under the FILE's pool. Those markets will not show against the other pool.",
  );
}

const client = new pg.Client({ connectionString });
await client.connect();

console.log(`${registry.markets.length} market(s) in markets.json for pool ${pool}${DRY_RUN ? " (dry run)" : ""}\n`);

let done = 0;
for (const m of registry.markets) {
  if (DRY_RUN) {
    console.log(`  would import #${m.id}  ${m.resolverType.padEnd(6)}  ${m.question}`);
    done++;
    continue;
  }

  await client.query(
    `INSERT INTO markets (pool, id, question, category, resolver_type, vault, resolver,
                          betting_close_time, resolution_start_time, created_at, spec)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (pool, id) DO UPDATE SET
       question = EXCLUDED.question,
       category = EXCLUDED.category,
       resolver_type = EXCLUDED.resolver_type,
       vault = EXCLUDED.vault,
       resolver = EXCLUDED.resolver,
       betting_close_time = EXCLUDED.betting_close_time,
       resolution_start_time = EXCLUDED.resolution_start_time,
       spec = EXCLUDED.spec`,
    [
      pool,
      m.id,
      m.question,
      m.category ?? "Monad",
      m.resolverType ?? "manual",
      m.vault,
      m.resolver,
      m.bettingCloseTime,
      m.resolutionStartTime,
      m.createdAt ?? Math.floor(Date.now() / 1000),
      m.spec ? JSON.stringify(m.spec) : null,
    ],
  );
  console.log(`  imported #${m.id}  ${m.question}`);
  done++;
}

const { rows } = await client.query("SELECT count(*)::int AS n FROM markets WHERE pool = $1", [pool]);
console.log(`\n${DRY_RUN ? "would import" : "imported"} ${done} market(s); table now holds ${rows[0].n} for this pool`);

await client.end();
