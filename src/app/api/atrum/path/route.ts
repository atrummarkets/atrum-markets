import { NextResponse } from "next/server";
import { requireUser } from "@/server/atrum/auth";
import { fetchPath } from "@/server/atrum/sequencerClient";

/**
 * Merkle path for a commitment, proxied to the sequencer.
 *
 * The browser needs a path to build any spend proof, and the sequencer is the only thing that
 * can produce one -- the contract keeps a frontier and a root, deliberately not the leaves.
 *
 * A PROXY RATHER THAN A DIRECT CALL, and the cost of that choice. Going straight from the
 * browser to `SEQUENCER_URL` would need CORS on the sequencer and would still tell the
 * sequencer which commitment is being spent. Proxying keeps the sequencer's URL and CORS
 * surface private, and tells this server the same thing. Either way somebody learns
 * "commitment X is about to be spent, by a session belonging to address Y" -- the anonymity
 * set that hides WHICH note a proof spends does not hide who ASKED for its path.
 *
 * That is a real, unclosed correlation channel and it is not fixed here. Fixing it means
 * fetching paths the user does not need alongside the one they do, or handing the client
 * enough of the tree to build paths itself (the sequencer already exposes leaves; at 2^20
 * depth the full set is large but a recent window is not). Left as Phase 3 with the same
 * honesty the rest of this codebase applies to its gaps.
 */
export async function GET(req: Request) {
  try {
    await requireUser();
    const commitment = new URL(req.url).searchParams.get("commitment");
    if (!commitment || !/^\d+$/.test(commitment)) {
      throw new Error("commitment must be a decimal string");
    }
    return NextResponse.json(await fetchPath(BigInt(commitment)));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
