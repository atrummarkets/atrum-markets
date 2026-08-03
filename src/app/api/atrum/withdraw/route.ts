import { NextResponse } from "next/server";
import { requireUser } from "@/server/atrum/auth";
import { withdraw } from "@/server/atrum/actions/withdraw";

export async function POST(req: Request) {
  try {
    const owner = await requireUser();
    const { noteId, amount, recipient } = await req.json();
    return NextResponse.json(await withdraw(owner, String(noteId), Number(amount), String(recipient)));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
