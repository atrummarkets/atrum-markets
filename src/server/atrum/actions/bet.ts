import { randomBytes } from "node:crypto";
import { init, noteCommitment, nullifierHash, packMarketMeta, FIELD_SIZE, OUTCOME_YES, OUTCOME_NO } from "../atrum.mjs";
import { buildElGamal } from "../elgamal.mjs";
import { committeeKey } from "../committee";
import { prove } from "../prove";
import { relay } from "../relay";
import { fetchPath } from "../sequencerClient";
import { getNote, addNote, updateNote, removeNote } from "../noteStore";
import { readMarket } from "../markets";



function randomField(): bigint {
  return BigInt("0x" + randomBytes(31).toString("hex")) % FIELD_SIZE;
}

export interface BetResult {
  id: string;
  txHash: string;
  relayer: string;
  gasUsed: string;
  provingMs: number;
}

export async function bet(
  owner: string,
  noteId: string,
  marketId: number,
  side: "yes" | "no",
): Promise<BetResult> {
  const spent = getNote(owner, noteId);
  if (spent.outcome !== 0) throw new Error("that note is not unbet collateral");
  if (spent.status === "spent") throw new Error("that note is already spent");
  if (spent.status !== "grafted") throw new Error("that note is still queued -- wait for the next graft");

  // Check the window before spending seconds on a proof the contract would reject anyway.
  const market = await readMarket(marketId);
  if (market.phase !== "betting") throw new Error(`betting is closed on market ${marketId}`);

  await init();

  const path = await fetchPath(BigInt(spent.commitment));
  const outcome = side === "yes" ? OUTCOME_YES : OUTCOME_NO;
  const units = BigInt(spent.units);

  const newNullifier = randomField();
  const newSecret = randomField();
  const positionCommitment = noteCommitment({
    nullifier: newNullifier,
    secret: newSecret,
    marketId: BigInt(marketId),
    outcome,
    units,
  });
  const betNullifierHash = nullifierHash(BigInt(spent.nullifier));
  const betMeta = packMarketMeta(BigInt(marketId), outcome);

  const elgamal = await buildElGamal(committeeKey().pubKey);
  const encRandomness = elgamal.randomScalar();
  const cipher = elgamal.encrypt(units, encRandomness);
  const [c1x, c1y] = elgamal.asPair(cipher.c1);
  const [c2x, c2y] = elgamal.asPair(cipher.c2);

  const root = BigInt(path.root);

  const t0 = Date.now();
  const proof = await prove("bet_encrypted", {
    root,
    nullifierHash: betNullifierHash,
    newCommitment: positionCommitment,
    betMeta,
    c1: [c1x, c1y],
    c2: [c2x, c2y],
    nullifier: BigInt(spent.nullifier),
    secret: BigInt(spent.secret),
    newNullifier,
    newSecret,
    marketId: BigInt(marketId),
    outcome,
    units,
    encRandomness,
    pathElements: path.pathElements.map(BigInt),
    pathIndices: path.pathIndices.map(BigInt),
  });
  const provingMs = Date.now() - t0;

  // Persist the note this produces BEFORE broadcasting. If the tx never lands we delete it
  // below; if we crashed between a successful broadcast and this write, the secret would be
  // gone while the spend was already real.
  const id = positionCommitment.toString(16).slice(0, 8);
  addNote({
    id,
    owner,
    commitment: positionCommitment.toString(),
    nullifier: newNullifier.toString(),
    secret: newSecret.toString(),
    marketId: String(marketId),
    outcome: Number(outcome),
    units: units.toString(),
    status: "queued",
    label: `${side.toUpperCase()} · ${units} units`,
    createdAt: Date.now(),
  });

  let result;
  try {
    result = await relay("betEncrypted", proof, [
      root,
      betNullifierHash,
      positionCommitment,
      betMeta,
      [c1x, c1y, c2x, c2y],
    ]);
  } catch (error) {
    removeNote(owner, id);
    throw error;
  }

  updateNote(owner, id, { txHash: result.hash });
  // Mark the spent note spent only after confirmation.
  updateNote(owner, spent.id, { status: "spent" });

  return {
    id,
    txHash: result.hash,
    relayer: result.relayer,
    gasUsed: result.gasUsed,
    provingMs,
  };
}
