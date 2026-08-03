import { NextResponse } from "next/server";
import { requireUser } from "@/server/atrum/auth";
import { refreshNotes } from "@/server/atrum/refresh";

export async function GET() {
  try {
    const owner = await requireUser();
    return NextResponse.json({ notes: await refreshNotes(owner) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
