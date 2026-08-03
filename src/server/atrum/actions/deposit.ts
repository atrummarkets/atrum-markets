import { randomBytes } from "node:crypto";
import { init, noteCommitment, FIELD_SIZE, isValidDenomination, DENOMINATIONS } from "../atrum.mjs";
import { prove } from "../prove";
import { addNote, updateNote, getNote } from "../noteStore";

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
  addNote({
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

/** Record the hash once the user's wallet has actually landed the deposit. */
export function confirmDeposit(owner: string, id: string, txHash: string): void {
  getNote(owner, id);
  updateNote(owner, id, { txHash });
}
