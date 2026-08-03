import { NextResponse } from "next/server";
import { requireUser } from "@/server/atrum/auth";
import { confirmDeposit } from "@/server/atrum/actions/deposit";

export async function POST(req: Request) {
  try {
    const owner = await requireUser();
    const { id, txHash } = await req.json();
    confirmDeposit(owner, String(id), String(txHash));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
