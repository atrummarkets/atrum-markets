"use client";

/**
 * Main-thread interface to the proving worker.
 *
 * One worker, reused. Spawning per proof would re-pay worker startup and, worse, re-pay
 * snarkjs's module init on every action; the worker is idle between proofs and costs nothing
 * to keep. Requests are correlated by id rather than assuming ordered replies, because
 * nothing in the worker contract promises ordering.
 *
 * Serialised at the call site, not here: `marketContext`'s `run()` already refuses concurrent
 * actions, and two proofs at once on a phone would contend for the same core and finish
 * slower than one after the other.
 */
import { loadCircuit, type CircuitId, type FetchProgress } from "./artifacts";
import type { ProveRequest, ProveResponse } from "./prover.worker";

export interface Proof {
  pA: string[];
  pB: string[][];
  pC: string[];
  publicSignals: string[];
  provingMs: number;
}

/** What the caller may hand in: bigints and numbers are normalised to decimal strings. */
export type CircuitInput = Record<string, bigint | number | string | (bigint | number | string)[]>;

function normalise(input: CircuitInput): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = Array.isArray(value) ? value.map(String) : String(value);
  }
  return out;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (p: Proof) => void; reject: (e: Error) => void }>();

function ensureWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL("./prover.worker.ts", import.meta.url));

  worker.onmessage = (event: MessageEvent<ProveResponse>) => {
    const data = event.data;
    const waiter = pending.get(data.id);
    if (!waiter) return;
    pending.delete(data.id);
    if (data.ok) {
      waiter.resolve({
        pA: data.pA,
        pB: data.pB,
        pC: data.pC,
        publicSignals: data.publicSignals,
        provingMs: data.provingMs,
      });
    } else {
      waiter.reject(new Error(data.error));
    }
  };

  // A worker-level error leaves every in-flight request unanswered, and a promise that never
  // settles shows the user a spinner forever. Fail them all and drop the worker so the next
  // action starts clean.
  worker.onerror = (event) => {
    const error = new Error(event.message || "the proving worker crashed");
    for (const [, waiter] of pending) waiter.reject(error);
    pending.clear();
    worker?.terminate();
    worker = null;
  };

  return worker;
}

export interface ProveOptions {
  onProgress?: (p: FetchProgress) => void;
  /** Fired once artifacts are in hand and the worker has actually started proving. */
  onProvingStart?: () => void;
}

/**
 * Prove `circuit` over `input`, fetching (and caching) its artifacts first.
 *
 * The returned proof is in Solidity calldata form -- exactly what `ShieldedPool` expects and
 * what the relay endpoint forwards verbatim.
 */
export async function prove(
  circuit: CircuitId,
  input: CircuitInput,
  options: ProveOptions = {},
): Promise<Proof> {
  const { wasm, zkey } = await loadCircuit(circuit, options.onProgress);
  options.onProvingStart?.();

  const id = nextId++;
  const request: ProveRequest = { id, wasm, zkey, input: normalise(input) };

  return new Promise<Proof>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    // Transferred, so the 10MB zkey moves rather than being cloned. Both buffers are detached
    // here and must not be touched again on this side -- `loadCircuit` returns fresh copies
    // from the cache on the next call, so nothing downstream depends on them surviving.
    ensureWorker().postMessage(request, [wasm, zkey]);
  });
}

/** Tears the worker down. For tests and for a hard reset from the boundary page. */
export function terminateProver(): void {
  worker?.terminate();
  worker = null;
  for (const [, waiter] of pending) waiter.reject(new Error("proving was cancelled"));
  pending.clear();
}
