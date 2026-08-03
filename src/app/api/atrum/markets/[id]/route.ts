import { NextResponse } from "next/server";
import { readMarket, readPool } from "@/server/atrum/markets";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const [market, pool] = await Promise.all([readMarket(Number(id)), readPool()]);
    return NextResponse.json({ market, pool });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}
