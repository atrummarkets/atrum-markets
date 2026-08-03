import { randomBytes } from "node:crypto";
import { init, noteCommitment, nullifierHash, packRedeemMeta, FIELD_SIZE, OUTCOME_YES } from "../atrum.mjs";
import { prove } from "../prove";
import { relay } from "../relay";
import { fetchPath } from "../sequencerClient";
import { getNote, addNote, updateNote, removeNote } from "../noteStore";
import { readMarket } from "../markets";

function randomField(): bigint {
  return BigInt("0x" + randomBytes(31).toString("hex")) % FIELD_SIZE;
}

const SETTLED_OUTCOME = 3n;

export interface RedeemResult {
  id: string;
  txHash: string;
  payout: string;
  relayer: string;
  gasUsed: string;
  provingMs: number;
}

export async function redeem(owner: string, noteId: string): Promise<RedeemResult> {
  const spent = getNote(owner, noteId);
  if (spent.outcome !== 1 && spent.outcome !== 2) throw new Error("that note is not a YES/NO position");
  if (spent.status === "spent") throw new Error("that note is already spent");
  if (spent.status !== "grafted") throw new Error("that note is still queued -- wait for the next graft");

  const marketId = Number(spent.marketId);
  const market = await readMarket(marketId);
  if (!market.settled) throw new Error("that market is not settled yet");

  const totalPool = BigInt(market.yesUnits + market.noUnits);
  const positionOutcome = BigInt(spent.outcome);
  const winningPool = BigInt(positionOutcome === OUTCOME_YES ? market.yesUnits : market.noUnits);
  if (winningPool === 0n) throw new Error("this position's side did not win -- there is nothing to redeem");

  await init();

  const units = BigInt(spent.units);
  // Exact integer division, truncating DOWN, matching the in-circuit constraint
  // `units * totalPool == payout * winningPool + remainder`. Truncating down is what keeps
  // the sum of all payouts strictly under the pool.
  const dividend = units * totalPool;
  const payout = dividend / winningPool;
  const remainder = dividend % winningPool;

  const path = await fetchPath(BigInt(spent.commitment));

  const newNullifier = randomField();
  const newSecret = randomField();
  const settledCommitment = noteCommitment({
    nullifier: newNullifier,
    secret: newSecret,
    marketId: BigInt(marketId),
    outcome: SETTLED_OUTCOME,
    units: payout,
  });
  const rpNullifierHash = nullifierHash(BigInt(spent.nullifier));
  const redeemMeta = packRedeemMeta(BigInt(marketId), positionOutcome, totalPool, winningPool);
  const root = BigInt(path.root);

  const t0 = Date.now();
  const proof = await prove("redeem_private", {
    root,
    nullifierHash: rpNullifierHash,
    newCommitment: settledCommitment,
    redeemMeta,
    nullifier: BigInt(spent.nullifier),
    secret: BigInt(spent.secret),
    newNullifier,
    newSecret,
    marketId: BigInt(marketId),
    outcome: positionOutcome,
    units,
    totalPool,
    winningPool,
    payout,
    remainder,
    pathElements: path.pathElements.map(BigInt),
    pathIndices: path.pathIndices.map(BigInt),
  });
  const provingMs = Date.now() - t0;

  const id = settledCommitment.toString(16).slice(0, 8);
  addNote({
    id,
    owner,
    commitment: settledCommitment.toString(),
    nullifier: newNullifier.toString(),
    secret: newSecret.toString(),
    marketId: String(marketId),
    outcome: Number(SETTLED_OUTCOME),
    units: payout.toString(),
    status: "queued",
    label: `Settled payout · ${payout} units`,
    createdAt: Date.now(),
  });

  let result;
  try {
    result = await relay("redeemPrivate", proof, [root, rpNullifierHash, settledCommitment, redeemMeta]);
  } catch (error) {
    removeNote(owner, id);
    throw error;
  }

  updateNote(owner, id, { txHash: result.hash });
  updateNote(owner, spent.id, { status: "spent" });

  return {
    id,
    txHash: result.hash,
    payout: payout.toString(),
    relayer: result.relayer,
    gasUsed: result.gasUsed,
    provingMs,
  };
}
