import { NextResponse } from "next/server";
import { SEQUENCER_URL } from "@/server/atrum/chain";

/**
 * The commitment tree's leaf set, proxied from the sequencer.
 *
 * THIS ROUTE REPLACES `/api/atrum/path`, and the difference is the whole point. Asking for one
 * commitment's path told this server exactly which note the caller was about to spend -- a
 * Merkle proof hides which leaf was used, and then the lookup that produced it named it. This
 * route serves the same list to everyone, so a request reveals nothing about the caller beyond
 * "somebody is syncing". The client builds the tree and derives its own path offline
 * (`lib/atrum/client/tree.ts`).
 *
 * DELIBERATELY UNAUTHENTICATED. Requiring a session would put an address back beside every
 * sync and reintroduce, in weaker form, the correlation this exists to remove. There is
 * nothing here to protect: every leaf is already public in `flushBatch` calldata, and the
 * response is byte-identical regardless of who asks. Reconstructing the same set from
 * `eth_getLogs` is possible but impractical against the public RPC's 100-block cap, so this
 * saves clients work rather than granting them access.
 *
 * `?since=N` returns only the tail, so a warm client re-fetches a handful of leaves per poll
 * rather than the whole tree.
 */
export async function GET(req: Request) {
  try {
    const since = new URL(req.url).searchParams.get("since") ?? "0";
    if (!/^\d+$/.test(since)) throw new Error("since must be a non-negative integer");

    const res = await fetch(`${SEQUENCER_URL}/leaves?since=${since}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `sequencer /leaves failed (${res.status})`);
    }

    return NextResponse.json(await res.json(), {
      // The tail changes only when a batch grafts, and the client revalidates by asking for a
      // new `since` anyway. A short shared cache keeps a room full of pollers off the
      // sequencer without ever serving a client a leaf set shorter than one it already has.
      headers: { "cache-control": "public, max-age=2, s-maxage=2" },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
