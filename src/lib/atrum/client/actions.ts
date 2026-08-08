"use client";

/**
 * The four shielded actions, built entirely in the browser.
 *
 * These mirror `server/atrum/actions/{deposit,bet,redeem,withdraw}.ts` step for step -- same
 * witness fields in the same order, same packing helpers, same pre-flight checks -- with one
 * difference that is the whole point: the note secrets are derived here, the proof is built
 * here, and what leaves the browser is a proof plus its public arguments. The server never
 * holds anything that could spend a note.
 *
 * WHY MIRRORED AND NOT SHARED. The server versions load secrets from Postgres and prove
 * against files on disk; the client versions derive secrets from the vault and prove against
 * cached ArrayBuffers in a worker. The arithmetic between those two ends is identical, and it
 * lives in `crypto.ts` (`noteCommitment`, `nullifierHash`, the packers) which BOTH import --
 * so the part that must agree bit-for-bit is shared, and only the I/O differs. Duplicating the
 * packing helpers instead would be a fourth implementation of rules that already exist in the
 * circuit, the contract, and `atrum.mjs`, which is precisely how those three drift apart.
 *
 * ORDERING RULE, INHERITED FROM THE SERVER PATH AND KEPT. The note a spend produces is written
 * to the vault BEFORE the transaction is relayed, and removed again if the relay throws. A
 * crash between a successful broadcast and the vault write would leave a real, grafted,
 * unspendable note -- funds visible on chain that nothing can ever redeem.
 */
import {
  init,
  noteCommitment,
  nullifierHash,
  packMarketMeta,
  packRedeemMeta,
  packWithdrawData,
  isValidDenomination,
  snapToDenomination,
  buildElGamal,
  DENOMINATIONS,
  OUTCOME_YES,
} from "./crypto";
import { prove, type ProveOptions } from "./prover";
import { pathFor } from "./tree";
import { Vault, type VaultNote } from "./vault";
import type { CircuitId } from "./artifacts";

const SETTLED_OUTCOME = 3n;

export interface ActionContext {
  vault: Vault;
  /** Persists the vault after a mutation. Awaited before anything is broadcast. */
  save: () => Promise<void>;
  committeePubKey: readonly [string, string];
}

export interface RelayOutcome {
  txHash: string;
  relayer: string;
  gasUsed: string;
}

// ---------------------------------------------------------------------------
// Server calls -- everything here is public data
// ---------------------------------------------------------------------------

async function relay(
  action: "betEncrypted" | "redeemPrivate" | "withdraw",
  proof: { pA: string[]; pB: string[][]; pC: string[] },
  args: (bigint | bigint[])[],
): Promise<RelayOutcome> {
  const res = await fetch("/api/atrum/relay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action,
      pA: proof.pA,
      pB: proof.pB,
      pC: proof.pC,
      args: args.map((a) => (Array.isArray(a) ? a.map(String) : String(a))),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "relay failed");
  return { txHash: body.hash, relayer: body.relayer, gasUsed: body.gasUsed };
}

// ---------------------------------------------------------------------------
// Shared guards
// ---------------------------------------------------------------------------

/**
 * The checks every spend shares, run BEFORE a proof is built.
 *
 * Proving costs the user seconds of phone CPU and up to 11.8MB of download. Discovering a
 * note is already spent after paying that is a straightforwardly bad experience, and the
 * contract would reject it anyway.
 */
function assertSpendable(note: VaultNote): void {
  if (note.status === "spent") throw new Error("that note is already spent");
  if (note.status !== "grafted") {
    throw new Error("that note is still queued -- wait for the next graft");
  }
}

// ---------------------------------------------------------------------------
// Deposit
// ---------------------------------------------------------------------------

export interface PreparedDeposit {
  id: string;
  index: number;
  commitment: string;
  units: string;
  pA: string[];
  pB: string[][];
  pC: string[];
  provingMs: number;
}

/**
 * Build the deposit proof the user's own wallet will submit.
 *
 * Deposit is the one action that cannot be relayed -- `transferFrom(msg.sender)` means whoever
 * sends it pays -- so this returns calldata rather than broadcasting. The boundary is public
 * by design, and moving proving into the browser does not change that.
 *
 * The note is recorded (and the vault saved) before the caller is handed the calldata, because
 * the instant they broadcast, the commitment is real and worthless without these secrets.
 */
export async function prepareDeposit(
  ctx: ActionContext,
  units: number,
  options: ProveOptions = {},
): Promise<PreparedDeposit> {
  const unitsBig = BigInt(units);
  if (!isValidDenomination(unitsBig)) {
    throw new Error(
      `${units} is not a denomination. Powers of ten only: ${DENOMINATIONS.slice(0, 6).join(", ")}, ...`,
    );
  }

  await init();

  const { index, nullifier, secret } = await ctx.vault.allocate();
  const commitment = noteCommitment({
    nullifier,
    secret,
    marketId: 0n,
    outcome: 0n,
    units: unitsBig,
  });

  const proof = await prove("deposit", { commitment, units: unitsBig, nullifier, secret }, options);

  const id = commitment.toString(16).slice(0, 8);
  ctx.vault.add({
    id,
    index,
    commitment: commitment.toString(),
    marketId: "0",
    outcome: 0,
    units: unitsBig.toString(),
    status: "queued",
    label: `Deposit · ${units} units`,
    createdAt: Date.now(),
  });
  await ctx.save();

  return {
    id,
    index,
    commitment: commitment.toString(),
    units: unitsBig.toString(),
    pA: proof.pA,
    pB: proof.pB,
    pC: proof.pC,
    provingMs: proof.provingMs,
  };
}

/** Record the hash once the wallet has actually landed the deposit. */
export async function confirmDeposit(ctx: ActionContext, id: string, txHash: string): Promise<void> {
  ctx.vault.update(id, { txHash });
  await ctx.save();
}

// ---------------------------------------------------------------------------
// Bet
// ---------------------------------------------------------------------------

export interface BetResult extends RelayOutcome {
  id: string;
  provingMs: number;
}

export async function bet(
  ctx: ActionContext,
  noteId: string,
  marketId: number,
  side: "yes" | "no",
  options: ProveOptions = {},
): Promise<BetResult> {
  const spent = ctx.vault.note(noteId);
  if (spent.outcome !== 0) throw new Error("that note is not unbet collateral");
  assertSpendable(spent);

  await init();

  const { nullifier: spentNullifier, secret: spentSecret } = await ctx.vault.secretsFor(spent);
  const path = await pathFor(BigInt(spent.commitment));
  const outcome = side === "yes" ? 1n : 2n;
  const units = BigInt(spent.units);

  const { index, nullifier: newNullifier, secret: newSecret } = await ctx.vault.allocate();
  const positionCommitment = noteCommitment({
    nullifier: newNullifier,
    secret: newSecret,
    marketId: BigInt(marketId),
    outcome,
    units,
  });
  const betNullifierHash = nullifierHash(spentNullifier);
  const betMeta = packMarketMeta(BigInt(marketId), outcome);

  // Encrypted to the committee's PUBLIC key, which the browser holds legitimately -- it is the
  // encryption target, served by /api/atrum/config. The secret half is never here.
  const elgamal = await buildElGamal(ctx.committeePubKey);
  const encRandomness = elgamal.randomScalar();
  const cipher = elgamal.encrypt(units, encRandomness);
  const [c1x, c1y] = elgamal.asPair(cipher.c1);
  const [c2x, c2y] = elgamal.asPair(cipher.c2);

  const root = BigInt(path.root);

  const proof = await prove(
    "bet_encrypted",
    {
      root,
      nullifierHash: betNullifierHash,
      newCommitment: positionCommitment,
      betMeta,
      c1: [c1x, c1y],
      c2: [c2x, c2y],
      nullifier: spentNullifier,
      secret: spentSecret,
      newNullifier,
      newSecret,
      marketId: BigInt(marketId),
      outcome,
      units,
      encRandomness,
      pathElements: path.pathElements,
      pathIndices: path.pathIndices,
    },
    options,
  );

  const id = positionCommitment.toString(16).slice(0, 8);
  ctx.vault.add({
    id,
    index,
    commitment: positionCommitment.toString(),
    marketId: String(marketId),
    outcome: Number(outcome),
    units: units.toString(),
    status: "queued",
    label: `${side.toUpperCase()} · ${units} units`,
    createdAt: Date.now(),
  });
  await ctx.save();

  let result: RelayOutcome;
  try {
    result = await relay("betEncrypted", proof, [
      root,
      betNullifierHash,
      positionCommitment,
      betMeta,
      [c1x, c1y, c2x, c2y],
    ]);
  } catch (error) {
    ctx.vault.remove(id);
    await ctx.save();
    throw error;
  }

  ctx.vault.update(id, { txHash: result.txHash });
  ctx.vault.update(spent.id, { status: "spent" });
  await ctx.save();

  return { ...result, id, provingMs: proof.provingMs };
}

// ---------------------------------------------------------------------------
// Redeem
// ---------------------------------------------------------------------------

export interface RedeemResult extends RelayOutcome {
  id: string;
  payout: string;
  provingMs: number;
}

export async function redeem(
  ctx: ActionContext,
  noteId: string,
  market: { yesUnits: number; noUnits: number; settled: boolean },
  options: ProveOptions = {},
): Promise<RedeemResult> {
  const spent = ctx.vault.note(noteId);
  if (spent.outcome !== 1 && spent.outcome !== 2) throw new Error("that note is not a YES/NO position");
  assertSpendable(spent);
  if (!market.settled) throw new Error("that market is not settled yet");

  const marketId = Number(spent.marketId);
  const totalPool = BigInt(market.yesUnits + market.noUnits);
  const positionOutcome = BigInt(spent.outcome);
  const winningPool = BigInt(positionOutcome === OUTCOME_YES ? market.yesUnits : market.noUnits);
  if (winningPool === 0n) throw new Error("this position's side did not win -- there is nothing to redeem");

  await init();

  const units = BigInt(spent.units);
  // Exact integer division truncating DOWN, matching the in-circuit constraint
  // `units * totalPool == payout * winningPool + remainder`. Truncating down is what keeps the
  // sum of all payouts strictly under the pool.
  const dividend = units * totalPool;
  const payout = dividend / winningPool;
  const remainder = dividend % winningPool;

  const { nullifier: spentNullifier, secret: spentSecret } = await ctx.vault.secretsFor(spent);
  const path = await pathFor(BigInt(spent.commitment));

  const { index, nullifier: newNullifier, secret: newSecret } = await ctx.vault.allocate();
  const settledCommitment = noteCommitment({
    nullifier: newNullifier,
    secret: newSecret,
    marketId: BigInt(marketId),
    outcome: SETTLED_OUTCOME,
    units: payout,
  });
  const rpNullifierHash = nullifierHash(spentNullifier);
  const redeemMeta = packRedeemMeta(BigInt(marketId), positionOutcome, totalPool, winningPool);
  const root = BigInt(path.root);

  const proof = await prove(
    "redeem_private",
    {
      root,
      nullifierHash: rpNullifierHash,
      newCommitment: settledCommitment,
      redeemMeta,
      nullifier: spentNullifier,
      secret: spentSecret,
      newNullifier,
      newSecret,
      marketId: BigInt(marketId),
      outcome: positionOutcome,
      units,
      totalPool,
      winningPool,
      payout,
      remainder,
      pathElements: path.pathElements,
      pathIndices: path.pathIndices,
    },
    options,
  );

  const id = settledCommitment.toString(16).slice(0, 8);
  ctx.vault.add({
    id,
    index,
    commitment: settledCommitment.toString(),
    marketId: String(marketId),
    outcome: Number(SETTLED_OUTCOME),
    units: payout.toString(),
    status: "queued",
    label: `Settled payout · ${payout} units`,
    createdAt: Date.now(),
  });
  await ctx.save();

  let result: RelayOutcome;
  try {
    result = await relay("redeemPrivate", proof, [root, rpNullifierHash, settledCommitment, redeemMeta]);
  } catch (error) {
    ctx.vault.remove(id);
    await ctx.save();
    throw error;
  }

  ctx.vault.update(id, { txHash: result.txHash });
  ctx.vault.update(spent.id, { status: "spent" });
  await ctx.save();

  return { ...result, id, payout: payout.toString(), provingMs: proof.provingMs };
}

// ---------------------------------------------------------------------------
// Withdraw
// ---------------------------------------------------------------------------

export interface WithdrawResult extends RelayOutcome {
  changeId: string | null;
  recipient: string;
  provingMs: number;
}

export async function withdraw(
  ctx: ActionContext,
  noteId: string,
  amount: number,
  recipient: string,
  /** Live rung occupancy and floor, read from chain by the caller. */
  rung: { atRung: bigint; minAnonymitySet: bigint },
  options: ProveOptions = {},
): Promise<WithdrawResult> {
  const spent = ctx.vault.note(noteId);
  if (spent.outcome !== 0 && spent.outcome !== 3) {
    throw new Error("only UNBET collateral or a SETTLED payout can be withdrawn");
  }
  assertSpendable(spent);

  if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) throw new Error("recipient is not a valid address");

  const amountBig = BigInt(amount);
  const unitsBig = BigInt(spent.units);
  if (amountBig <= 0n) throw new Error("amount must be greater than zero");
  if (amountBig > unitsBig) throw new Error(`that note holds only ${unitsBig} units`);

  // The withdrawn amount is PUBLIC, so it must be a ladder rung or it identifies the position
  // that earned it. Checked before proving; the contract enforces it regardless.
  if (!isValidDenomination(amountBig)) {
    const nearest = snapToDenomination(amountBig);
    throw new Error(
      `${amount} is not a denomination (powers of ten only)` +
        (nearest ? ` -- the largest rung at or below it is ${nearest}` : ""),
    );
  }
  if (rung.atRung < rung.minAnonymitySet) {
    throw new Error(
      `only ${rung.atRung} deposit(s) have ever used the ${amount}-unit rung, and the floor is ` +
        `${rung.minAnonymitySet}. Withdrawing it would name you. Pick a rung others have used.`,
    );
  }

  await init();

  const change = unitsBig - amountBig;
  const { nullifier: spentNullifier, secret: spentSecret } = await ctx.vault.secretsFor(spent);
  const path = await pathFor(BigInt(spent.commitment));
  const unbetExit = spent.outcome === 0;
  const marketIdForCircuit = unbetExit ? 0n : BigInt(spent.marketId);

  const { index, nullifier: newNullifier, secret: newSecret } = await ctx.vault.allocate();
  const changeCommitment = noteCommitment({
    nullifier: newNullifier,
    secret: newSecret,
    marketId: marketIdForCircuit,
    outcome: BigInt(spent.outcome),
    units: change,
  });
  const wdNullifierHash = nullifierHash(spentNullifier);
  const withdrawData = packWithdrawData(unbetExit, BigInt(recipient), amountBig);
  const root = BigInt(path.root);

  const proof = await prove(
    "withdraw",
    {
      root,
      nullifierHash: wdNullifierHash,
      changeCommitment,
      withdrawData,
      nullifier: spentNullifier,
      secret: spentSecret,
      newNullifier,
      newSecret,
      marketId: marketIdForCircuit,
      units: unitsBig,
      recipient: BigInt(recipient),
      amount: amountBig,
      change,
      pathElements: path.pathElements,
      pathIndices: path.pathIndices,
    },
    options,
  );

  let changeId: string | null = null;
  if (change > 0n) {
    changeId = changeCommitment.toString(16).slice(0, 8);
    ctx.vault.add({
      id: changeId,
      index,
      commitment: changeCommitment.toString(),
      marketId: marketIdForCircuit.toString(),
      outcome: spent.outcome,
      units: change.toString(),
      status: "queued",
      label: `Change · ${change} units`,
      createdAt: Date.now(),
    });
    await ctx.save();
  }

  let result: RelayOutcome;
  try {
    result = await relay("withdraw", proof, [root, wdNullifierHash, changeCommitment, withdrawData]);
  } catch (error) {
    if (changeId) {
      ctx.vault.remove(changeId);
      await ctx.save();
    }
    throw error;
  }

  if (changeId) ctx.vault.update(changeId, { txHash: result.txHash });
  ctx.vault.update(spent.id, { status: "spent" });
  await ctx.save();

  return { ...result, changeId, recipient, provingMs: proof.provingMs };
}

export type { CircuitId };
