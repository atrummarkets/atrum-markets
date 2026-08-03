import { buildElGamal } from "./elgamal.mjs";
import { committeeKey } from "./committee";
import {
  publicClient,
  POOL_ADDRESS,
  POOL_ABI,
  VAULT_ABI,
  TOTALS_ABI,
  ACCUMULATOR_ABI,
  OUTCOME_YES,
  OUTCOME_NO,
} from "./chain";
import { loadRegistry, registryMarket, type RegistryMarket } from "./registry";



// Stakes are denomination UNITS (10, 100, ...), never raw token amounts, so BSGS over this
// bound is instant. Same bound `resolve-and-settle.mjs` uses for real settlement.
const DECRYPT_BOUND = 10_000_000n;

export type MarketPhase = "betting" | "closed" | "resolved" | "settled";

export interface MarketSnapshot {
  marketId: number;
  question: string;
  category: string;
  phase: MarketPhase;
  outcome: "YES" | "NO" | "UNRESOLVED";
  bettingCloseTime: number;
  resolutionStartTime: number;
  yesUnits: number;
  noUnits: number;
  oddsYesPct: number;
  settled: boolean;
  vault: string;
}

export interface PoolSnapshot {
  totalDeposits: number;
  minAnonymitySet: number;
  anonymityOk: boolean;
  queuedCount: number;
  batchCount: number;
  denomination: string;
}

export async function readPool(): Promise<PoolSnapshot> {
  const [totalDeposits, minAnonymitySet, queuedCount, batchCount, denomination] = await Promise.all([
    publicClient.readContract({ address: POOL_ADDRESS, abi: POOL_ABI, functionName: "totalDeposits" }),
    publicClient.readContract({ address: POOL_ADDRESS, abi: POOL_ABI, functionName: "minAnonymitySet" }),
    publicClient.readContract({ address: POOL_ADDRESS, abi: POOL_ABI, functionName: "queuedCount" }),
    publicClient.readContract({ address: POOL_ADDRESS, abi: POOL_ABI, functionName: "batchCount" }),
    publicClient.readContract({ address: POOL_ADDRESS, abi: POOL_ABI, functionName: "denomination" }),
  ]);
  return {
    totalDeposits: Number(totalDeposits),
    minAnonymitySet: Number(minAnonymitySet),
    anonymityOk: Number(totalDeposits) >= Number(minAnonymitySet),
    queuedCount: Number(queuedCount),
    batchCount: Number(batchCount),
    denomination: denomination.toString(),
  };
}

let totalsAddressCache: `0x${string}` | null = null;
async function totalsAddress(): Promise<`0x${string}`> {
  if (!totalsAddressCache) {
    totalsAddressCache = (await publicClient.readContract({
      address: POOL_ADDRESS,
      abi: POOL_ABI,
      functionName: "encryptedTotals",
    })) as `0x${string}`;
  }
  return totalsAddressCache;
}

let accumulatorAddressCache: `0x${string}` | null = null;
async function accumulatorAddress(): Promise<`0x${string}`> {
  if (!accumulatorAddressCache) {
    accumulatorAddressCache = (await publicClient.readContract({
      address: await totalsAddress(),
      abi: TOTALS_ABI,
      functionName: "accumulator",
    })) as `0x${string}`;
  }
  return accumulatorAddressCache;
}

/**
 * Live totals for one market.
 *
 * Once settled they are public on chain. Before that, nothing publishes a running ratio --
 * the publisher service in `DESIGN-PRIVACY.md` is unbuilt -- so this demo decrypts the
 * accumulator with the disclosed committee secret, SERVER-SIDE ONLY, and returns just the
 * rounded percentage. Real deployments publish a coarse, rate-limited ratio instead, precisely
 * because a fine-grained live ratio lets an observer solve backwards for individual stakes.
 */
async function readTotals(marketId: number, settled: boolean): Promise<{ yes: number; no: number }> {
  if (settled) {
    const addr = await totalsAddress();
    const [yes, no] = await Promise.all([
      publicClient.readContract({ address: addr, abi: TOTALS_ABI, functionName: "finalYesTotal", args: [marketId] }),
      publicClient.readContract({ address: addr, abi: TOTALS_ABI, functionName: "finalNoTotal", args: [marketId] }),
    ]);
    return { yes: Number(yes), no: Number(no) };
  }

  const acc = await accumulatorAddress();
  const elgamal = await buildElGamal(committeeKey().pubKey, committeeKey().secret);
  const pointOf = (x: bigint, y: bigint) => [elgamal.F.e(x), elgamal.F.e(y)];

  const [yesRaw, noRaw] = await Promise.all([
    publicClient.readContract({ address: acc, abi: ACCUMULATOR_ABI, functionName: "totalAffine", args: [marketId, OUTCOME_YES] }),
    publicClient.readContract({ address: acc, abi: ACCUMULATOR_ABI, functionName: "totalAffine", args: [marketId, OUTCOME_NO] }),
  ]);
  const [c1xY, c1yY, c2xY, c2yY] = yesRaw as [bigint, bigint, bigint, bigint];
  const [c1xN, c1yN, c2xN, c2yN] = noRaw as [bigint, bigint, bigint, bigint];

  return {
    yes: Number(elgamal.decrypt(pointOf(c1xY, c1yY), pointOf(c2xY, c2yY), DECRYPT_BOUND)),
    no: Number(elgamal.decrypt(pointOf(c1xN, c1yN), pointOf(c2xN, c2yN), DECRYPT_BOUND)),
  };
}

async function readOne(entry: RegistryMarket): Promise<MarketSnapshot> {
  const vault = entry.vault as `0x${string}`;

  const [outcomeRaw, bettingCloseTime, resolutionStartTime, settled] = await Promise.all([
    publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: "outcome" }),
    publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: "bettingCloseTime" }),
    publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: "resolutionStartTime" }),
    totalsAddress().then((addr) =>
      publicClient.readContract({ address: addr, abi: TOTALS_ABI, functionName: "settled", args: [entry.id] }),
    ),
  ]);

  const outcomeNum = Number(outcomeRaw);
  const { yes, no } = await readTotals(entry.id, settled as boolean);

  const now = Math.floor(Date.now() / 1000);
  let phase: MarketPhase = "betting";
  if (settled) phase = "settled";
  else if (outcomeNum !== 0) phase = "resolved";
  else if (now >= Number(bettingCloseTime)) phase = "closed";

  const total = yes + no;

  return {
    marketId: entry.id,
    question: entry.question,
    category: entry.category,
    phase,
    outcome: outcomeNum === 1 ? "YES" : outcomeNum === 2 ? "NO" : "UNRESOLVED",
    bettingCloseTime: Number(bettingCloseTime),
    resolutionStartTime: Number(resolutionStartTime),
    yesUnits: yes,
    noUnits: no,
    oddsYesPct: total > 0 ? Math.round((yes / total) * 100) : 50,
    settled: settled as boolean,
    vault: entry.vault,
  };
}

export async function readMarket(id: number): Promise<MarketSnapshot> {
  const entry = registryMarket(id);
  if (!entry) throw new Error(`market ${id} is not in the registry`);
  return readOne(entry);
}

export async function readAllMarkets(): Promise<MarketSnapshot[]> {
  const { markets } = loadRegistry();
  const snapshots = await Promise.all(markets.map(readOne));
  // Open markets first, closing soonest at the top; everything decided sinks to the bottom.
  const rank = (m: MarketSnapshot) => (m.phase === "betting" ? 0 : m.phase === "closed" ? 1 : 2);
  return snapshots.sort((a, b) => rank(a) - rank(b) || a.bettingCloseTime - b.bettingCloseTime);
}
