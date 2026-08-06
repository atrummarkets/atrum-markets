import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "./db";
import { POOL_ADDRESS } from "./chain";

export interface RegistryMarket {
  id: number;
  question: string;
  category: string;
  resolverType: "manual" | "oracle";
  vault: string;
  resolver: string;
  bettingCloseTime: number;
  resolutionStartTime: number;
  createdAt: number;
  spec?: unknown;
}

interface Registry {
  pool: string;
  collateral: string;
  markets: RegistryMarket[];
}

interface MarketRow {
  id: number;
  question: string;
  category: string;
  resolver_type: "manual" | "oracle";
  vault: string;
  resolver: string;
  betting_close_time: string;
  resolution_start_time: string;
  created_at: string;
  spec: unknown;
}

const SELECT = `SELECT id, question, category, resolver_type, vault, resolver,
                       betting_close_time, resolution_start_time, created_at, spec
                  FROM markets WHERE lower(pool) = lower($1)`;

function fromRow(r: MarketRow): RegistryMarket {
  return {
    id: r.id,
    question: r.question,
    category: r.category,
    resolverType: r.resolver_type,
    vault: r.vault,
    resolver: r.resolver,
    bettingCloseTime: Number(r.betting_close_time),
    resolutionStartTime: Number(r.resolution_start_time),
    createdAt: Number(r.created_at),
    spec: r.spec ?? undefined,
  };
}

/**
 * The market list.
 *
 * `ShieldedPool` cannot enumerate its own markets -- there is no array, only `marketVault[id]`
 * -- and this project's rule is never to build on `eth_getLogs` (the public Monad RPC caps the
 * range at 100 blocks). So the id list has to come from somewhere off-chain.
 *
 * IT USED TO COME FROM A FILE, AND THAT WAS THE PROBLEM. `markets.json` was read out of the
 * deployment bundle, so a market created by `create-market.mjs` did not exist as far as
 * production was concerned until someone committed the regenerated file and waited for a
 * redeploy. Creating a market was a deploy. Now it is an INSERT, live on the next request.
 *
 * It remains a CACHE OF IDS AND LABELS, not a price feed. Everything the UI acts on -- betting
 * window, outcome, settled totals -- is re-read from chain per request in `markets.ts`, so a
 * stale or tampered row can list or omit a market but never misstate one. `vault` is safe to
 * store because `marketVault[id]` is write-once on chain: `registerEncryptedMarket` reverts
 * with `MarketAlreadyRegistered` if the id is taken, so the address cannot change underneath.
 *
 * Scoped to the CURRENT pool. Several pools have been orphaned on this deployment already, and
 * the file's single top-level `pool` field would have served a dead pool's markets against a
 * live one without complaint.
 */
export async function loadRegistry(): Promise<Registry> {
  const { rows } = await db().query<MarketRow>(`${SELECT} ORDER BY id`, [POOL_ADDRESS]);

  // An empty table falls back to the file, which keeps local dev working without a migrated
  // database and makes the import safe to run in either order. Deliberately all-or-nothing:
  // merging the two sources would make "where did this market come from?" unanswerable, and a
  // half-imported registry would look identical to a complete one.
  if (rows.length === 0) return loadFileRegistry();

  return { pool: POOL_ADDRESS, collateral: "", markets: rows.map(fromRow) };
}

/** The pre-database registry. A fallback, and the source `db/import-markets.mjs` reads. */
export function loadFileRegistry(): Registry {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "markets.json"), "utf8")) as Registry;
  } catch {
    return { pool: POOL_ADDRESS, collateral: "", markets: [] };
  }
}

export async function registryMarket(id: number): Promise<RegistryMarket | undefined> {
  const { rows } = await db().query<MarketRow>(`${SELECT} AND id = $2`, [POOL_ADDRESS, id]);
  if (rows.length === 0) return loadFileRegistry().markets.find((m) => m.id === id);
  return fromRow(rows[0]);
}

/**
 * Record a market.
 *
 * Idempotent on (pool, id), so re-running a creation script cannot duplicate a row and a
 * corrected question can be written over a typo without a manual DELETE. `created_at` is
 * deliberately not overwritten -- it records when the market first appeared, not when its
 * label was last edited.
 */
export async function upsertMarket(market: RegistryMarket & { pool?: string }): Promise<void> {
  await db().query(
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
      (market.pool ?? POOL_ADDRESS).toLowerCase(),
      market.id,
      market.question,
      market.category,
      market.resolverType,
      market.vault,
      market.resolver,
      market.bettingCloseTime,
      market.resolutionStartTime,
      market.createdAt,
      market.spec ? JSON.stringify(market.spec) : null,
    ],
  );
}
