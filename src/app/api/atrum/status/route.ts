import { NextResponse } from "next/server";
import { SEQUENCER_URL } from "@/server/atrum/chain";
import { readPool } from "@/server/atrum/markets";
import { loadRegistry } from "@/server/atrum/registry";

/**
 * Public service status.
 *
 * PUBLIC ON PURPOSE, and scoped to what is already public. Everything here is either readable
 * from the pool by anyone (`totalDeposits`, `minAnonymitySet`, `queuedCount`, `batchCount`) or
 * a plain liveness fact about a service. A user whose deposit has been queued for ten minutes
 * deserves to see whether the sequencer is up rather than guess, and telling them costs
 * nothing that was not already on chain.
 *
 * WHAT IS DELIBERATELY NOT HERE: account balances, relayer addresses, and the list of markets
 * awaiting resolution. Those live in `/api/atrum/admin/health` behind an operator session.
 * Not because they are secret -- relayer addresses appear as `from` on every relayed
 * transaction -- but because publishing "these three accounts are the ones that halt the
 * product when empty, and here is how close each is to empty" is an invitation, and it buys
 * an ordinary user nothing.
 *
 * `anonymityOk` is included even though it reads as bad news when false: it is the difference
 * between "the site is broken" and "the pool needs more deposits before actions are allowed",
 * and a user who cannot tell those apart concludes the former.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const [poolResult, sequencerResult, registryResult] = await Promise.allSettled([
    readPool(),
    fetch(`${SEQUENCER_URL}/health`, { signal: AbortSignal.timeout(8000) }).then(async (r) =>
      r.ok ? ((await r.json()) as { leaves: number }) : Promise.reject(new Error(`http ${r.status}`)),
    ),
    loadRegistry(),
  ]);

  // Settled individually: the sequencer being unreachable must not blank the pool numbers,
  // which come from a different system entirely and are the ones a user is usually after.
  const pool = poolResult.status === "fulfilled" ? poolResult.value : null;
  const sequencerUp = sequencerResult.status === "fulfilled";
  const markets = registryResult.status === "fulfilled" ? registryResult.value.markets : [];

  const now = Math.floor(Date.now() / 1000);
  const open = markets.filter((m) => now < m.bettingCloseTime).length;

  return NextResponse.json({
    chain: poolResult.status === "fulfilled" ? "ok" : "unreachable",
    sequencer: sequencerUp ? "ok" : "unreachable",
    leaves: sequencerUp ? (sequencerResult.value as { leaves: number }).leaves : null,
    markets: { total: markets.length, open },
    pool: pool && {
      totalDeposits: pool.totalDeposits,
      minAnonymitySet: pool.minAnonymitySet,
      anonymityOk: pool.anonymityOk,
      queuedCount: pool.queuedCount,
      batchCount: pool.batchCount,
    },
    checkedAt: new Date().toISOString(),
  });
}
