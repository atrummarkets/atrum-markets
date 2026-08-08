"use client";

/**
 * Fetching and caching the 29.7MB of proving artifacts.
 *
 * WHY THE CACHE API AND NOT INDEXEDDB. Both persist across sessions; the Cache API stores
 * `Response` objects, so a hit needs no deserialisation step and hands back an ArrayBuffer at
 * roughly memcpy speed. IndexedDB would mean storing and re-wrapping raw buffers by hand for
 * no benefit. HANDOFF.md's browser measurement assumed IndexedDB; nothing in that measurement
 * depends on which of the two is used.
 *
 * WHY SIZES ARE READ FROM A MANIFEST. `scripts/stage-circuits.mjs` measures the staged files
 * and writes their real byte counts. Hardcoding them here would put a fourth copy of a number
 * that changes on every `make circuits` into the tree -- the same reasoning that made the UI
 * parse constraint counts from the `.r1cs` rather than transcribe them.
 *
 * ONLY WHAT IS ASKED FOR IS FETCHED. Nobody needs all four circuits: a first-time user needs
 * `deposit` (2.4MB), and `bet_encrypted` (11.8MB) only once they actually bet. Prefetching
 * the set would spend a user's data on circuits they may never run.
 */
export type CircuitId = "deposit" | "bet_encrypted" | "redeem_private" | "withdraw";

const CACHE_NAME = "atrum-circuits-v1";
const BASE = "/circuits";

export interface ArtifactManifest {
  [circuit: string]: { wasm: number; zkey: number };
}

let manifestPromise: Promise<ArtifactManifest> | null = null;

export function fetchManifest(): Promise<ArtifactManifest> {
  manifestPromise ??= fetch(`${BASE}/manifest.json`).then((r) => {
    if (!r.ok) throw new Error("circuit manifest is missing -- run scripts/stage-circuits.mjs");
    return r.json();
  });
  return manifestPromise;
}

/** Total bytes a circuit costs to download, or 0 if every part is already cached. */
export async function downloadCost(circuit: CircuitId): Promise<number> {
  const [manifest, cache] = await Promise.all([fetchManifest(), caches.open(CACHE_NAME)]);
  const entry = manifest[circuit];
  if (!entry) throw new Error(`unknown circuit ${circuit}`);

  let cost = 0;
  for (const kind of ["wasm", "zkey"] as const) {
    const hit = await cache.match(`${BASE}/${circuit}.${kind}`);
    if (!hit) cost += entry[kind];
  }
  return cost;
}

export interface FetchProgress {
  circuit: CircuitId;
  /** Bytes transferred so far across both artifacts of this circuit. */
  loaded: number;
  total: number;
  cached: boolean;
}

/**
 * Fetch one artifact, serving from cache when present.
 *
 * The cache is written only after a fully-read, `ok` response. A truncated zkey is not an
 * error snarkjs reports usefully -- it surfaces later as an unexplained proving failure -- so
 * a partial download must never be stored as if it were complete.
 */
async function load(
  circuit: CircuitId,
  kind: "wasm" | "zkey",
  expected: number,
  onChunk: (bytes: number) => void,
): Promise<ArrayBuffer> {
  const url = `${BASE}/${circuit}.${kind}`;
  const cache = await caches.open(CACHE_NAME);

  const hit = await cache.match(url);
  if (hit) return hit.arrayBuffer();

  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} failed (${res.status})`);

  // Streamed rather than `res.arrayBuffer()` so a 10MB download can report progress. A user
  // staring at a frozen button for 20 seconds concludes the site is broken.
  const reader = res.body?.getReader();
  if (!reader) {
    const buf = await res.arrayBuffer();
    onChunk(buf.byteLength);
    await cache.put(url, new Response(buf.slice(0)));
    return buf;
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onChunk(value.length);
  }

  const buf = new Uint8Array(received);
  let at = 0;
  for (const c of chunks) {
    buf.set(c, at);
    at += c.length;
  }

  if (expected && received !== expected) {
    throw new Error(`${url} is ${received} bytes, manifest says ${expected} -- refusing to cache a partial artifact`);
  }

  await cache.put(url, new Response(buf.slice(0) as BlobPart));
  return buf.buffer as ArrayBuffer;
}

/** Both artifacts for a circuit, cached for next time. */
export async function loadCircuit(
  circuit: CircuitId,
  onProgress?: (p: FetchProgress) => void,
): Promise<{ wasm: ArrayBuffer; zkey: ArrayBuffer }> {
  const manifest = await fetchManifest();
  const entry = manifest[circuit];
  if (!entry) throw new Error(`unknown circuit ${circuit}`);

  const total = entry.wasm + entry.zkey;
  const cost = await downloadCost(circuit);
  let loaded = 0;
  const report = (bytes: number) => {
    loaded += bytes;
    onProgress?.({ circuit, loaded, total, cached: cost === 0 });
  };

  onProgress?.({ circuit, loaded: 0, total, cached: cost === 0 });

  // Sequential, not parallel: two concurrent multi-megabyte reads on a phone contend for
  // bandwidth and make the progress number jump around without finishing sooner.
  const wasm = await load(circuit, "wasm", entry.wasm, report);
  const zkey = await load(circuit, "zkey", entry.zkey, report);
  return { wasm, zkey };
}

/** Drops every cached artifact. Exposed for the boundary page, and for recovering from a bad cache. */
export async function clearArtifactCache(): Promise<void> {
  await caches.delete(CACHE_NAME);
}
