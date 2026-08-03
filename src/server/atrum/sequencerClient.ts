import { SEQUENCER_URL } from "./chain";

export interface MerklePath {
  index: number;
  root: string;
  pathElements: string[];
  pathIndices: string[];
}

/** Grafted paths only. Throws if the commitment hasn't been batched into the tree yet. */
export async function fetchPath(commitment: bigint): Promise<MerklePath> {
  const res = await fetch(`${SEQUENCER_URL}/path?commitment=${commitment.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`sequencer /path failed: ${body.error ?? res.statusText}`);
  }
  return res.json();
}

export async function isGrafted(commitment: bigint): Promise<boolean> {
  try {
    await fetchPath(commitment);
    return true;
  } catch {
    return false;
  }
}

export async function sequencerHealth(): Promise<{ status: string; leaves: number; root: string }> {
  const res = await fetch(`${SEQUENCER_URL}/health`);
  if (!res.ok) throw new Error("sequencer unreachable");
  return res.json();
}
