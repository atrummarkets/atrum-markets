import { NextResponse } from "next/server";
import { requireUser } from "@/server/atrum/auth";
import { redeem } from "@/server/atrum/actions/redeem";

export async function POST(req: Request) {
  try {
    const owner = await requireUser();
    const { noteId } = await req.json();
    return NextResponse.json(await redeem(owner, String(noteId)));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
