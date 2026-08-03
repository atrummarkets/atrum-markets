import { readFileSync } from "node:fs";
import { join } from "node:path";

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
}

interface Registry {
  pool: string;
  collateral: string;
  markets: RegistryMarket[];
}

/**
 * The market list.
 *
 * `ShieldedPool` cannot enumerate its own markets -- there is no array, only `marketVault[id]`
 * -- and this project's rule is never to build on `eth_getLogs` (the public Monad RPC caps the
 * range at 100 blocks). So the id list comes from a file written by `seed-markets.mjs`.
 *
 * It is a CACHE OF IDS, not a price feed. Everything the UI acts on -- betting window, outcome,
 * settled totals -- is re-read from the chain per request in `markets.ts`. A stale registry can
 * only list or omit a market, never misstate one.
 */
export function loadRegistry(): Registry {
  return JSON.parse(readFileSync(join(process.cwd(), "markets.json"), "utf8"));
}

export function registryMarket(id: number): RegistryMarket | undefined {
  return loadRegistry().markets.find((m) => m.id === id);
}
