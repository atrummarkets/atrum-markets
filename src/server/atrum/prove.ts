import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as snarkjs from "snarkjs";
import { ATRUM_CORE_DIR } from "./chain";

const BUILD = join(ATRUM_CORE_DIR, "circuits", "build");

export interface ProofResult {
  pA: readonly [bigint, bigint];
  pB: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  pC: readonly [bigint, bigint];
  publicSignals: string[];
}

/**
 * Builds a real Groth16 proof against this repo's compiled circuits, exactly the way
 * `circuits/scripts/gen_action_fixtures.mjs` does -- same wasm/zkey, same snarkjs
 * calldata encoding (which swaps G2 limbs relative to the raw proof).
 */
export async function prove(circuit: string, input: Record<string, unknown>): Promise<ProofResult> {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    join(BUILD, `${circuit}_js`, `${circuit}.wasm`),
    join(BUILD, `${circuit}.zkey`),
  );

  const vkey = JSON.parse(readFileSync(join(BUILD, `${circuit}_vkey.json`), "utf8"));
  const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  if (!ok) throw new Error(`${circuit}: snarkjs rejected its own proof`);

  const raw = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const [pA, pB, pC, signals]: [string[], string[][], string[], string[]] = JSON.parse(`[${raw}]`);
  return {
    pA: [BigInt(pA[0]), BigInt(pA[1])],
    pB: [
      [BigInt(pB[0][0]), BigInt(pB[0][1])],
      [BigInt(pB[1][0]), BigInt(pB[1][1])],
    ],
    pC: [BigInt(pC[0]), BigInt(pC[1])],
    publicSignals: signals,
  };
}
