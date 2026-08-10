import { NextRequest, NextResponse } from "next/server";
import { requireOperator } from "@/server/atrum/auth";
import { getTimeSeries, type TimeSeriesMetric } from "@/server/atrum/analytics";

export const dynamic = "force-dynamic";

const VALID_METRICS: TimeSeriesMetric[] = ["bets", "volume", "dau"];

export async function GET(request: NextRequest) {
  try {
    await requireOperator();

    const { searchParams } = new URL(request.url);
    const metric = searchParams.get("metric") ?? "bets";
    if (!VALID_METRICS.includes(metric as TimeSeriesMetric)) {
      return NextResponse.json(
        { error: `metric must be one of: ${VALID_METRICS.join(", ")}` },
        { status: 400 },
      );
    }
    const days = Number(searchParams.get("days") ?? "30");

    const points = await getTimeSeries(metric as TimeSeriesMetric, days);
    return NextResponse.json({ metric, points });
  } catch (error) {
    const message = (error as Error).message;
    const denied = message.includes("not authorised") || message.includes("not signed in");
    return NextResponse.json({ error: message }, { status: denied ? 403 : 500 });
  }
}
