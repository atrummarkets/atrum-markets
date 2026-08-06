/// <reference lib="webworker" />

/**
 * Groth16 proving, off the main thread.
 *
 * WHY A WORKER, decided in HANDOFF.md §0-bis before any of this was built: `bet_encrypted`
 * takes ~1.8s in a browser, and snarkjs is synchronous CPU work. On the main thread that is
 * 1.8s of frozen UI -- no spinner animates, no click registers, and the freeze arrives right
 * after the user commits to a bet, which is the worst possible moment to look broken.
 *
 * Artifacts arrive as ArrayBuffers from `artifacts.ts` rather than being fetched here, so
 * caching and progress reporting live in one place and this file does exactly one job.
 * They are TRANSFERRED, not copied -- a 10MB structured clone per proof is pure waste.
 *
 * Inputs cross as decimal strings, not BigInt. BigInt is structured-cloneable, but snarkjs
 * accepts decimal strings natively and strings survive any serialisation boundary this might
 * later be pushed through (a SharedWorker, a service worker) without a second thought.
 */
import * as snarkjs from "snarkjs";

export interface ProveRequest {
  id: number;
  wasm: ArrayBuffer;
  zkey: ArrayBuffer;
  /** Field elements as decimal strings; arrays for `pathElements` / `pathIndices` / points. */
  input: Record<string, string | string[]>;
}

export type ProveResponse =
  | { id: number; ok: true; pA: string[]; pB: string[][]; pC: string[]; publicSignals: string[]; provingMs: number }
  | { id: number; ok: false; error: string };

self.onmessage = async (event: MessageEvent<ProveRequest>) => {
  const { id, wasm, zkey, input } = event.data;
  const t0 = Date.now();

  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      new Uint8Array(wasm),
      new Uint8Array(zkey),
    );

    // The same calldata encoding the server path used, and the same reason: snarkjs swaps the
    // G2 limbs relative to the raw proof, so hand-assembling `pB` from `proof.pi_b` produces a
    // proof the verifier rejects with no useful diagnostic.
    const raw = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const [pA, pB, pC, signals]: [string[], string[][], string[], string[]] = JSON.parse(`[${raw}]`);

    const response: ProveResponse = {
      id,
      ok: true,
      pA,
      pB,
      pC,
      publicSignals: signals,
      provingMs: Date.now() - t0,
    };
    self.postMessage(response);
  } catch (error) {
    const response: ProveResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
