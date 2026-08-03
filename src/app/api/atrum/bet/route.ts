import { NextResponse } from "next/server";
import { requireUser } from "@/server/atrum/auth";
import { bet } from "@/server/atrum/actions/bet";

export async function POST(req: Request) {
  try {
    const owner = await requireUser();
    const { noteId, marketId, side } = await req.json();
    if (side !== "yes" && side !== "no") throw new Error("side must be 'yes' or 'no'");
    return NextResponse.json(await bet(owner, String(noteId), Number(marketId), side));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
