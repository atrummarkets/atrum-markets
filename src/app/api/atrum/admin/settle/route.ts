import { NextResponse } from "next/server";
import { requireOperator } from "@/server/atrum/auth";
import { settleMarket } from "@/server/atrum/actions/admin";

export async function POST(req: Request) {
  try {
    await requireOperator();
    const { marketId } = await req.json();
    return NextResponse.json(await settleMarket(Number(marketId)));
  } catch (error) {
    const message = (error as Error).message;
    // 403 for the auth failures, so a rejected caller is not told it was a bad request.
    const denied = message.includes("not authorised") || message.includes("not signed in");
    return NextResponse.json({ error: message }, { status: denied ? 403 : 400 });
  }
}
