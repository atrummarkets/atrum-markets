import { randomBytes } from "node:crypto";
import { init, noteCommitment, FIELD_SIZE, isValidDenomination, DENOMINATIONS } from "../atrum.mjs";
import { prove } from "../prove";
import { addNote, updateNote, getNote } from "../noteStore";
import { publicClient, POOL_ADDRESS } from "../chain";
import { recordEvent } from "../analytics";

function randomField(): bigint {
  return BigInt("0x" + randomBytes(31).toString("hex")) % FIELD_SIZE;
}

export interface PreparedDeposit {
  id: string;
  commitment: string;
  units: string;
  /** Groth16 calldata, for the browser to pass to `ShieldedPool.deposit`. */
  pA: string[];
  pB: string[][];
  pC: string[];
  provingMs: number;
}

/**
 * Build a deposit proof for the user to submit THEMSELVES.
 *
 * Deposit is the one action that cannot be relayed: it pulls collateral with
 * `transferFrom(msg.sender)`, so whoever sends it is whoever pays. Relaying would just move
 * the payment link one hop along -- the user would have had to fund the relayer first. So the
 * boundary is public by design, and this returns calldata rather than broadcasting.
 *
 * The note is persisted here, BEFORE the user is handed the calldata, because the moment they
 * broadcast it the commitment is real and unspendable without these secrets. A note whose
 * transaction is never sent is harmless: it simply never grafts, and `prune` sweeps it.
 */
export async function prepareDeposit(owner: string, units: number): Promise<PreparedDeposit> {
  const unitsBig = BigInt(units);
  if (!isValidDenomination(unitsBig)) {
    throw new Error(
      `${units} is not a denomination. Powers of ten only: ${DENOMINATIONS.slice(0, 6).join(", ")}, ...`,
    );
  }

  await init();

  const nullifier = randomField();
  const secret = randomField();
  const commitment = noteCommitment({
    nullifier,
    secret,
    marketId: 0n,
    outcome: 0n,
    units: unitsBig,
  });

  const t0 = Date.now();
  const proof = await prove("deposit", { commitment, units: unitsBig, nullifier, secret });
  const provingMs = Date.now() - t0;

  const id = commitment.toString(16).slice(0, 8);
  await addNote({
    id,
    owner,
    commitment: commitment.toString(),
    nullifier: nullifier.toString(),
    secret: secret.toString(),
    marketId: "0",
    outcome: 0,
    units: unitsBig.toString(),
    status: "queued",
    label: `Deposit · ${units} units`,
    createdAt: Date.now(),
  });

  return {
    id,
    commitment: commitment.toString(),
    units: unitsBig.toString(),
    pA: proof.pA.map(String),
    pB: proof.pB.map((row) => row.map(String)),
    pC: proof.pC.map(String),
    provingMs,
  };
}

/**
 * Record the hash once the user's wallet has actually landed the deposit.
 *
 * `txHash` is client-supplied and otherwise untrusted -- this is the one deposit-path value
 * nobody relays or otherwise re-verifies server-side. Confirming a real, successful,
 * on-pool receipt here (rather than trusting the string) is what stops a fabricated hash
 * from inflating deposit volume in analytics_events for free.
 */
export async function confirmDeposit(owner: string, id: string, txHash: string): Promise<void> {
  const note = await getNote(owner, id);

  const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
  if (receipt.status !== "success") throw new Error("that transaction did not succeed");
  if (receipt.to?.toLowerCase() !== POOL_ADDRESS.toLowerCase()) {
    throw new Error("that transaction was not a deposit into this pool");
  }

  await updateNote(owner, id, { txHash });
  void recordEvent({ eventType: "deposit_confirmed", units: note.units });
}
