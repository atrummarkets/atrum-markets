import { NextResponse } from "next/server";
import { requireOperator } from "@/server/atrum/auth";
import { resolveMarket } from "@/server/atrum/actions/admin";

export async function POST(req: Request) {
  try {
    await requireOperator();
    const { marketId, side } = await req.json();
    if (side !== "YES" && side !== "NO") throw new Error("side must be 'YES' or 'NO'");
    return NextResponse.json(await resolveMarket(Number(marketId), side));
  } catch (error) {
    const message = (error as Error).message;
    // 403 for the auth failures, so a rejected caller is not told it was a bad request.
    const denied = message.includes("not authorised") || message.includes("not signed in");
    return NextResponse.json({ error: message }, { status: denied ? 403 : 400 });
  }
}
