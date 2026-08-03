import { NextResponse } from "next/server";
import { resolveMarket } from "@/server/atrum/actions/admin";

export async function POST(req: Request) {
  try {
    const { marketId, side } = await req.json();
    if (side !== "YES" && side !== "NO") throw new Error("side must be 'YES' or 'NO'");
    return NextResponse.json(await resolveMarket(Number(marketId), side));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
