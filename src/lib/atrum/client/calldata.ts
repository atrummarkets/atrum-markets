/**
 * snarkjs proof output, in the form the contracts and the relay route expect.
 *
 * WHY THIS IS ITS OWN MODULE. Two things need it -- `prover.worker.ts` in the browser, and the
 * Node test harness that stands in for a Worker -- and when the harness carried its own copy,
 * the two drifted: the worker was fixed to emit decimal limbs and the harness kept emitting
 * hex, so the unit suite passed while every live relay was rejected. Shared code cannot drift.
 *
 * TWO TRANSFORMS, BOTH LOAD-BEARING.
 *
 * `exportSolidityCallData` swaps the G2 limbs relative to the raw proof. Hand-assembling `pB`
 * from `proof.pi_b` instead produces a proof the verifier rejects with no useful diagnostic,
 * so the export is used rather than reimplemented.
 *
 * Its output is HEX, and `/api/atrum/relay` accepts decimal field elements only -- it checks
 * every limb against /^\d+$/ before spending the operator's gas. Normalising here rather than
 * loosening that check keeps one wire format for field elements, which is what makes the
 * validation worth having.
 */
export interface Calldata {
  pA: string[];
  pB: string[][];
  pC: string[];
  publicSignals: string[];
}

/** snarkjs's `groth16.exportSolidityCallData`, narrowed to what is actually used. */
type ExportCallData = (proof: unknown, publicSignals: unknown) => Promise<string>;

export async function toCalldata(
  exportSolidityCallData: ExportCallData,
  proof: unknown,
  publicSignals: unknown,
): Promise<Calldata> {
  const raw = await exportSolidityCallData(proof, publicSignals);
  const [pA, pB, pC, signals]: [string[], string[][], string[], string[]] = JSON.parse(`[${raw}]`);

  const dec = (v: string) => BigInt(v).toString();
  return {
    pA: pA.map(dec),
    pB: pB.map((row) => row.map(dec)),
    pC: pC.map(dec),
    publicSignals: signals.map(dec),
  };
}
