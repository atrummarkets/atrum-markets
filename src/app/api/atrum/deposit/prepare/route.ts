import { NextResponse } from "next/server";
import { requireUser } from "@/server/atrum/auth";
import { prepareDeposit } from "@/server/atrum/actions/deposit";

export async function POST(req: Request) {
  try {
    const owner = await requireUser();
    const { units } = await req.json();
    return NextResponse.json(await prepareDeposit(owner, Number(units)));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
