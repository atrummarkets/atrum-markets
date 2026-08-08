/**
 * The browser surface `artifacts.ts` and `prover.ts` need, implemented for Node.
 *
 * Only three things are missing under Node: the Cache API, `Worker`, and a `fetch` that can
 * serve `/circuits/*` and the app's own API routes. Shimming them means the tests drive the
 * REAL `actions.ts`/`prover.ts`/`artifacts.ts` rather than a paraphrase of them.
 *
 * The Worker shim runs snarkjs inline on the same thread. That deliberately does NOT cover
 * `prover.worker.ts` itself -- worker bundling is a build-time concern and is covered by
 * `next build`, not by anything Node can check.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as snarkjs from "snarkjs";
import { toCalldata } from "../src/lib/atrum/client/calldata.ts";

const ROOT = join(import.meta.dirname, "..");
const PUBLIC = join(ROOT, "public");

/** In-memory Cache API. Persistence is a browser guarantee; correctness of use is what matters. */
class FakeCache {
  #entries = new Map();
  async match(url) {
    const hit = this.#entries.get(url);
    return hit ? new Response(hit) : undefined;
  }
  async put(url, response) {
    this.#entries.set(url, Buffer.from(await response.arrayBuffer()));
  }
}

const caches_ = new Map();
globalThis.caches = {
  open: async (name) => {
    if (!caches_.has(name)) caches_.set(name, new FakeCache());
    return caches_.get(name);
  },
  delete: async (name) => caches_.delete(name),
};

/**
 * Routes `/circuits/*` to the staged files on disk and hands everything else to a per-test
 * handler. An unhandled API path throws rather than silently returning undefined -- a test
 * that quietly skips a network call is a test that proves nothing.
 */
let apiHandler = async (url) => {
  throw new Error(`no API handler registered for ${url}`);
};

export function onApi(handler) {
  apiHandler = handler;
}

/**
 * Node's own fetch, kept before it is replaced.
 *
 * `live-client-proving.test.mjs` talks to a REAL dev server, so it needs a way past this shim.
 * Capturing it inside the test is too late -- importing this module has already swapped it.
 */
globalThis.__realFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;

  if (url.startsWith("/circuits/")) {
    const buf = await readFile(join(PUBLIC, url));
    return new Response(buf, { status: 200 });
  }
  return apiHandler(url, init);
};

/** Runs the proof inline, mirroring `prover.worker.ts`'s contract exactly. */
globalThis.Worker = class FakeWorker {
  onmessage = null;
  onerror = null;

  postMessage(request) {
    const { id, wasm, zkey, input } = request;
    const t0 = Date.now();
    (async () => {
      try {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
          input,
          new Uint8Array(wasm),
          new Uint8Array(zkey),
        );
        // The SHARED encoder, not a copy of it. This harness previously carried its own and
        // drifted: the worker was fixed to emit decimal limbs, this kept emitting hex, and the
        // unit suite passed while the live relay rejected every proof.
        const { pA, pB, pC, publicSignals: signals } = await toCalldata(
          snarkjs.groth16.exportSolidityCallData,
          proof,
          publicSignals,
        );
        this.onmessage?.({
          data: { id, ok: true, pA, pB, pC, publicSignals: signals, provingMs: Date.now() - t0 },
        });
      } catch (error) {
        this.onmessage?.({ data: { id, ok: false, error: error.message } });
      }
    })();
  }

  terminate() {}
};

/** `new Worker(new URL(...))` needs a URL that resolves; nothing reads it under this shim. */
globalThis.URL = globalThis.URL;
