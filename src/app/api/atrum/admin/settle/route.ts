import { NextResponse } from "next/server";
import { settleMarket } from "@/server/atrum/actions/admin";

export async function POST(req: Request) {
  try {
    const { marketId } = await req.json();
    return NextResponse.json(await settleMarket(Number(marketId)));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
