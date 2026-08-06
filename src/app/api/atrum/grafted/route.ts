import { NextResponse } from "next/server";
import { requireUser } from "@/server/atrum/auth";
import { isGrafted } from "@/server/atrum/sequencerClient";

/**
 * Which of these commitments have been grafted into the tree.
 *
 * The client-side vault has to answer "is my note spendable yet?" for every queued note on a
 * 5-second poll. Doing that through `/api/atrum/path` would be one round trip per note per
 * tick; batching keeps it at one.
 *
 * Returns only membership, never the path. A path is what a spend needs, and handing out
 * paths for a list of commitments would make this a bulk oracle for tree contents. Membership
 * for a commitment the caller already knows tells them nothing they did not supply.
 */
const MAX_BATCH = 100;

export async function POST(req: Request) {
  try {
    await requireUser();
    const { commitments } = await req.json();

    if (!Array.isArray(commitments)) throw new Error("commitments must be an array");
    if (commitments.length > MAX_BATCH) {
      throw new Error(`at most ${MAX_BATCH} commitments per request`);
    }
    for (const c of commitments) {
      if (typeof c !== "string" || !/^\d+$/.test(c)) {
        throw new Error("each commitment must be a decimal string");
      }
    }

    const results = await Promise.all(
      (commitments as string[]).map(async (c) => [c, await isGrafted(BigInt(c))] as const),
    );

    return NextResponse.json({ grafted: Object.fromEntries(results) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
