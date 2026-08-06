"use client";

/**
 * A local mirror of the commitment tree, so Merkle paths are never requested by name.
 *
 * WHAT THIS CLOSES. `betEncrypted`, `redeemPrivate` and `withdraw` each prove membership of a
 * leaf without revealing which one -- and the old `/api/atrum/path?commitment=X` then told the
 * server precisely which one, on every single action, beside a session that named the address.
 * The cryptography hid the note and the plumbing announced it. Holding the leaves means the
 * path is derived offline and the only request that leaves the browser is one every client
 * makes identically.
 *
 * WHY THIS IS AFFORDABLE. Every leaf is public `flushBatch` calldata, and there are 576 of
 * them on the live pool -- about 18KB. `?since=N` fetches only the tail afterwards.
 *
 * WHERE IT STOPS SCALING, STATED PLAINLY. `MerkleTree` in `atrum.mjs` recomputes every level
 * on each `path()` call: ~1,200 Poseidon hashes at today's size, which is imperceptible, but
 * O(n) and therefore ~200,000 hashes at 100k leaves. Long before that this needs an
 * incremental tree that caches interior nodes, or the sequencer needs to serve subtree roots.
 * The correlation fix does not depend on which of those is used -- only on the client, not the
 * server, being the one that knows which leaf it wants.
 */
import { init, MerkleTree } from "@/server/atrum/atrum.mjs";

export interface LocalPath {
  index: number;
  root: string;
  pathElements: string[];
  pathIndices: string[];
}

interface LeavesResponse {
  since: number;
  total: number;
  root: string;
  leaves: string[];
}

/**
 * Module-level, because rebuilding a tree per action would re-pay the whole sync and rehash
 * for nothing. One mirror per page load, extended in place as batches graft.
 */
let tree: InstanceType<typeof MerkleTree> | null = null;
let leafCount = 0;
/** De-duplicates concurrent syncs -- a poll and an action can easily land together. */
let syncing: Promise<void> | null = null;

async function fetchLeaves(since: number): Promise<LeavesResponse> {
  const res = await fetch(`/api/atrum/leaves?since=${since}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "could not fetch the commitment tree");
  return body as LeavesResponse;
}

/** Pull any leaves grafted since the last sync. Cheap once warm. */
export async function syncTree(): Promise<void> {
  if (syncing) return syncing;

  syncing = (async () => {
    try {
      await init();
      tree ??= new MerkleTree();

      const response = await fetchLeaves(leafCount);

      // A shorter tree than the one already held means the sequencer reset and rebuilt its
      // mirror from chain (see its `reset()`). Rebuilding from scratch is the only safe
      // response: appending onto a stale prefix would produce paths for a tree that never
      // existed, and every proof built from them would fail verification with no diagnostic.
      if (response.total < leafCount) {
        tree = new MerkleTree();
        leafCount = 0;
        const fresh = await fetchLeaves(0);
        for (const leaf of fresh.leaves) tree.insert(BigInt(leaf));
        leafCount = fresh.leaves.length;
        return;
      }

      for (const leaf of response.leaves) tree.insert(BigInt(leaf));
      leafCount += response.leaves.length;
    } finally {
      syncing = null;
    }
  })();

  return syncing;
}

/**
 * The Merkle path for `commitment`, computed here.
 *
 * Syncs first, so a note that grafted moments ago is found rather than reported missing.
 */
export async function pathFor(commitment: bigint): Promise<LocalPath> {
  await syncTree();
  if (!tree) throw new Error("the commitment tree is not synced");

  const index = tree.leaves.findIndex((leaf: bigint) => leaf === commitment);
  if (index < 0) {
    throw new Error("that note has not been grafted into the tree yet -- wait for the next batch");
  }

  const { pathElements, pathIndices } = tree.path(index);
  return {
    index,
    root: tree.root().toString(),
    pathElements: pathElements.map(String),
    pathIndices: pathIndices.map(String),
  };
}

/**
 * Which of `commitments` are in the tree.
 *
 * Replaces `/api/atrum/grafted`, which had the same flaw as `/path` in bulk: it posted the
 * caller's queued commitments to the server on every poll. Membership is now a local lookup
 * against a leaf set the client already holds, so the poll costs one uniform request.
 */
export async function graftedSet(commitments: string[]): Promise<Record<string, boolean>> {
  if (commitments.length === 0) return {};
  await syncTree();

  const present = new Set(tree ? tree.leaves.map((leaf: bigint) => leaf.toString()) : []);
  return Object.fromEntries(commitments.map((c) => [c, present.has(c)]));
}

/** Leaf count currently mirrored. For tests and diagnostics. */
export function mirroredLeafCount(): number {
  return leafCount;
}

/** Drops the mirror. For tests, and for recovering from a suspected bad sync. */
export function resetTree(): void {
  tree = null;
  leafCount = 0;
  syncing = null;
}
