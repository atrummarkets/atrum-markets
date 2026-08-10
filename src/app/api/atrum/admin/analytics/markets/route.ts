import { NextResponse } from "next/server";
import { requireOperator } from "@/server/atrum/auth";
import { getMarketBreakdown } from "@/server/atrum/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireOperator();
    const markets = await getMarketBreakdown();
    return NextResponse.json({ markets });
  } catch (error) {
    const message = (error as Error).message;
    const denied = message.includes("not authorised") || message.includes("not signed in");
    return NextResponse.json({ error: message }, { status: denied ? 403 : 500 });
  }
}
