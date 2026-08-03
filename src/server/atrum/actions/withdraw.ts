import { randomBytes } from "node:crypto";
import { getAddress, isAddress } from "viem";
import { init, noteCommitment, nullifierHash, packWithdrawData, FIELD_SIZE, isValidDenomination, snapToDenomination } from "../atrum.mjs";
import { prove } from "../prove";
import { relay } from "../relay";
import { fetchPath } from "../sequencerClient";
import { getNote, addNote, updateNote, removeNote } from "../noteStore";
import { publicClient, POOL_ADDRESS, POOL_ABI } from "../chain";

function randomField(): bigint {
  return BigInt("0x" + randomBytes(31).toString("hex")) % FIELD_SIZE;
}

export interface WithdrawResult {
  changeId: string | null;
  txHash: string;
  relayer: string;
  gasUsed: string;
  provingMs: number;
  recipient: string;
}

export async function withdraw(
  owner: string,
  noteId: string,
  amount: number,
  recipient: string,
): Promise<WithdrawResult> {
  const spent = await getNote(owner, noteId);
  if (spent.outcome !== 0 && spent.outcome !== 3) {
    throw new Error("only UNBET collateral or a SETTLED payout can be withdrawn");
  }
  if (spent.status === "spent") throw new Error("that note is already spent");
  if (spent.status !== "grafted") throw new Error("that note is still queued -- wait for the next graft");

  if (!isAddress(recipient)) throw new Error("recipient is not a valid address");
  const to = getAddress(recipient);

  const amountBig = BigInt(amount);
  const unitsBig = BigInt(spent.units);
  if (amountBig <= 0n) throw new Error("amount must be greater than zero");
  if (amountBig > unitsBig) throw new Error(`that note holds only ${unitsBig} units`);

  // The withdrawn amount is PUBLIC, so it must be a ladder rung or it identifies the position
  // that earned it. Checked here so the user is told before paying for a proof that would
  // revert -- the contract enforces it regardless.
  if (!isValidDenomination(amountBig)) {
    const nearest = snapToDenomination(amountBig);
    throw new Error(
      `${amount} is not a denomination (powers of ten only)` +
        (nearest ? ` -- the largest rung at or below it is ${nearest}` : ""),
    );
  }

  // And the rung has to have a crowd, or being on the ladder buys nothing. Read live, because
  // `minAnonymitySet` and the per-rung count both move.
  const [atRung, minAnonymitySet] = await Promise.all([
    publicClient.readContract({ address: POOL_ADDRESS, abi: POOL_ABI, functionName: "depositsAtDenomination", args: [amountBig] }),
    publicClient.readContract({ address: POOL_ADDRESS, abi: POOL_ABI, functionName: "minAnonymitySet" }),
  ]);
  if (atRung < minAnonymitySet) {
    throw new Error(
      `only ${atRung} deposit(s) have ever used the ${amount}-unit rung, and the floor is ` +
        `${minAnonymitySet}. Withdrawing it would name you. Pick a rung others have used.`,
    );
  }

  await init();

  const change = unitsBig - amountBig;
  const path = await fetchPath(BigInt(spent.commitment));
  const unbetExit = spent.outcome === 0;
  const marketIdForCircuit = unbetExit ? 0n : BigInt(spent.marketId);

  const newNullifier = randomField();
  const newSecret = randomField();
  const changeCommitment = noteCommitment({
    nullifier: newNullifier,
    secret: newSecret,
    marketId: marketIdForCircuit,
    outcome: BigInt(spent.outcome),
    units: change,
  });
  const wdNullifierHash = nullifierHash(BigInt(spent.nullifier));
  const withdrawData = packWithdrawData(unbetExit, BigInt(to), amountBig);
  const root = BigInt(path.root);

  const t0 = Date.now();
  const proof = await prove("withdraw", {
    root,
    nullifierHash: wdNullifierHash,
    changeCommitment,
    withdrawData,
    nullifier: BigInt(spent.nullifier),
    secret: BigInt(spent.secret),
    newNullifier,
    newSecret,
    marketId: marketIdForCircuit,
    units: unitsBig,
    recipient: BigInt(to),
    amount: amountBig,
    change,
    pathElements: path.pathElements.map(BigInt),
    pathIndices: path.pathIndices.map(BigInt),
  });
  const provingMs = Date.now() - t0;

  let changeId: string | null = null;
  if (change > 0n) {
    changeId = changeCommitment.toString(16).slice(0, 8);
    await addNote({
      id: changeId,
      owner,
      commitment: changeCommitment.toString(),
      nullifier: newNullifier.toString(),
      secret: newSecret.toString(),
      marketId: marketIdForCircuit.toString(),
      outcome: spent.outcome,
      units: change.toString(),
      status: "queued",
      label: `Change · ${change} units`,
      createdAt: Date.now(),
    });
  }

  let result;
  try {
    result = await relay("withdraw", proof, [root, wdNullifierHash, changeCommitment, withdrawData]);
  } catch (error) {
    if (changeId) await removeNote(owner, changeId);
    throw error;
  }

  if (changeId) await updateNote(owner, changeId, { txHash: result.hash });
  await updateNote(owner, spent.id, { status: "spent" });

  return {
    changeId,
    txHash: result.hash,
    relayer: result.relayer,
    gasUsed: result.gasUsed,
    provingMs,
    recipient: to,
  };
}
