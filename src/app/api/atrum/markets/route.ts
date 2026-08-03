import { NextResponse } from "next/server";
import { readAllMarkets, readPool } from "@/server/atrum/markets";

export async function GET() {
  try {
    const [markets, pool] = await Promise.all([readAllMarkets(), readPool()]);
    return NextResponse.json({ markets, pool });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
