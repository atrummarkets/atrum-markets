import { NextResponse } from "next/server";
import { formatEther } from "viem";
import { requireOperator } from "@/server/atrum/auth";
import { publicClient, operatorAddress, SEQUENCER_URL, POOL_ADDRESS } from "@/server/atrum/chain";
import { dueOracleMarkets } from "@/server/atrum/actions/autoResolve";
import { readPool } from "@/server/atrum/markets";

/**
 * Operational health, in one place, for the operator.
 *
 * EVERY OUTAGE THIS DEPLOYMENT HAS HAD WAS A FUNDING PROBLEM DIAGNOSED BACKWARDS. A relay
 * account empties, and the symptom is a user's bet failing with "Signer had insufficient
 * balance" -- a message that names neither the account nor the cause. The batching wallet
 * empties and every `flushBatch` reverts, so deposits queue forever and look like a stuck
 * sequencer. Both have happened more than once, and each time the diagnosis started from a
 * broken user action rather than from a number anyone was watching.
 *
 * `ACTION_GAS_LIMIT` bills the full declared 2,500,000 regardless of use -- about 0.5 MON per
 * relayed action, and ~0.41 MON per batch -- so these accounts drain during ordinary use, not
 * only under abuse. Thresholds below are set from those measured costs, not guessed.
 *
 * Read-only. It moves no funds; `scripts/autofund.mjs` does that deliberately and separately.
 */
export const dynamic = "force-dynamic";

/** Roughly two actions of headroom. Below this, the next user action is at risk. */
const RELAYER_WARN_WEI = 1_000_000_000_000_000_000n; // 1 MON
/** Batching costs ~0.41 MON per flush; below this the queue stalls within a few batches. */
const BATCHER_WARN_WEI = 2_000_000_000_000_000_000n; // 2 MON
const OPERATOR_WARN_WEI = 2_000_000_000_000_000_000n; // 2 MON

interface Account {
  role: string;
  address: string;
  balance: string;
  balanceWei: string;
  low: boolean;
}

function account(role: string, address: string, wei: bigint, threshold: bigint): Account {
  return {
    role,
    address,
    balance: `${Number(formatEther(wei)).toFixed(3)} MON`,
    balanceWei: wei.toString(),
    low: wei < threshold,
  };
}

export async function GET() {
  try {
    await requireOperator();

    const accounts: Account[] = [];
    const problems: string[] = [];

    // --- operator ---
    const operatorWei = await publicClient.getBalance({ address: operatorAddress });
    accounts.push(account("operator", operatorAddress, operatorWei, OPERATOR_WARN_WEI));

    // --- sequencer: liveness, batching account, relayers ---
    let sequencer: { status: string; leaves?: number; root?: string } = { status: "unreachable" };
    try {
      const res = await fetch(`${SEQUENCER_URL}/health`, { signal: AbortSignal.timeout(8000) });
      sequencer = res.ok ? { status: "ok", ...(await res.json()) } : { status: `http ${res.status}` };
    } catch (error) {
      problems.push(`sequencer unreachable: ${(error as Error).message}`);
    }

    try {
      const res = await fetch(`${SEQUENCER_URL}/relayers`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const body = (await res.json()) as {
          relaying: boolean;
          accounts: { address: string; balanceWei: string }[];
        };
        if (!body.relaying) {
          // Not cosmetic: with relaying off, every user action puts the user's own address on
          // chain beside it, which is the property the whole design exists to prevent.
          problems.push("relaying is DISABLED on the sequencer -- user addresses will appear on chain");
        }
        for (const [i, a] of body.accounts.entries()) {
          accounts.push(account(`relayer ${i}`, a.address, BigInt(a.balanceWei), RELAYER_WARN_WEI));
        }
      } else {
        // Older sequencers have no /relayers; that is a deploy gap, not a healthy state.
        problems.push(`sequencer /relayers -> ${res.status} (is it running the current build?)`);
      }
    } catch (error) {
      problems.push(`could not read relayer balances: ${(error as Error).message}`);
    }

    // --- the batching account, read from the pool's immutable `sequencer` ---
    try {
      const batcher = (await publicClient.readContract({
        address: POOL_ADDRESS,
        abi: [
          { name: "sequencer", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
        ] as const,
        functionName: "sequencer",
      })) as `0x${string}`;
      const wei = await publicClient.getBalance({ address: batcher });
      accounts.push(account("batcher (pool.sequencer)", batcher, wei, BATCHER_WARN_WEI));
    } catch (error) {
      problems.push(`could not read the batching account: ${(error as Error).message}`);
    }

    // --- work that should have happened by now ---
    const due = await dueOracleMarkets();
    const pool = await readPool();

    for (const a of accounts) {
      if (a.low) problems.push(`${a.role} is low: ${a.balance} (${a.address})`);
    }
    if (!pool.anonymityOk) {
      problems.push(
        `anonymity set is ${pool.totalDeposits}, below the floor of ${pool.minAnonymitySet} -- actions will revert`,
      );
    }

    return NextResponse.json({
      healthy: problems.length === 0,
      problems,
      accounts,
      sequencer,
      pool,
      /** Oracle markets past their target that auto-resolve has not cleared. */
      dueOracleMarkets: due.map((m) => ({ id: m.id, question: m.question })),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = (error as Error).message;
    const denied = message.includes("not authorised") || message.includes("not signed in");
    return NextResponse.json({ error: message }, { status: denied ? 403 : 500 });
  }
}
