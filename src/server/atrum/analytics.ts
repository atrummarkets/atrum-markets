import { db } from "./db";

/**
 * Aggregate-only ops metrics.
 *
 * Atrum's entire product claim is that bettor identity and bet/payout amounts are hidden
 * from the operator (see nisi-master-reference.md). This module exists to answer "how many
 * bets, how much volume, how many wallets" without ever undermining that claim.
 *
 * HARD RULE: never write or read a query that puts a wallet address in the same row as a
 * bet amount, payout amount, deposit amount, withdrawal amount, market id, or outcome side.
 * `analytics_events` has no address column. `wallet_daily_activity` has no amount/market
 * column. Keep it that way -- do not "helpfully" join them by address.
 */

export type AnalyticsEventType =
  | "bet_placed"
  | "deposit_confirmed"
  | "withdrawal"
  | "redeem_payout"
  | "market_settled";

export interface RecordEventInput {
  eventType: AnalyticsEventType;
  marketId?: number;
  side?: "yes" | "no";
  units?: string | number | bigint;
  detail?: string;
}

/**
 * Fire-and-forget. Analytics must never break a bet/deposit/withdraw/redeem action --
 * a dropped metric is fine, a failed user action because the ledger insert failed is not.
 */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    await db().query(
      `INSERT INTO analytics_events (event_type, market_id, outcome_side, units, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.eventType,
        input.marketId ?? null,
        input.side?.toLowerCase() ?? null,
        input.units !== undefined ? input.units.toString() : null,
        input.detail ?? null,
      ],
    );
  } catch (err) {
    console.error("analytics.recordEvent failed", input.eventType, err);
  }
}

/** Fire-and-forget. Presence only -- never pair with an amount or market. */
export async function recordWalletSeen(address: string): Promise<void> {
  try {
    await db().query(
      `INSERT INTO wallet_daily_activity (address, activity_date)
       VALUES ($1, current_date)
       ON CONFLICT (address, activity_date) DO NOTHING`,
      [address.toLowerCase()],
    );
  } catch (err) {
    console.error("analytics.recordWalletSeen failed", err);
  }
}

interface WindowedTotal {
  event_type: AnalyticsEventType;
  all_time_count: string;
  all_time_units: string | null;
  d1_count: string;
  d7_count: string;
  d30_count: string;
}

export interface AnalyticsSummary {
  totals: Record<AnalyticsEventType, { count: number; units: number }>;
  last24h: Record<AnalyticsEventType, number>;
  last7d: Record<AnalyticsEventType, number>;
  last30d: Record<AnalyticsEventType, number>;
  dau: number;
  wau: number;
  mau: number;
  newWalletsToday: number;
}

const EVENT_TYPES: AnalyticsEventType[] = [
  "bet_placed",
  "deposit_confirmed",
  "withdrawal",
  "redeem_payout",
  "market_settled",
];

export async function getSummary(): Promise<AnalyticsSummary> {
  const { rows } = await db().query<WindowedTotal>(
    `SELECT
       event_type,
       count(*)::text AS all_time_count,
       sum(units)::text AS all_time_units,
       count(*) FILTER (WHERE created_at > now() - interval '1 day')::text AS d1_count,
       count(*) FILTER (WHERE created_at > now() - interval '7 days')::text AS d7_count,
       count(*) FILTER (WHERE created_at > now() - interval '30 days')::text AS d30_count
     FROM analytics_events
     GROUP BY event_type`,
  );

  const totals = {} as AnalyticsSummary["totals"];
  const last24h = {} as AnalyticsSummary["last24h"];
  const last7d = {} as AnalyticsSummary["last7d"];
  const last30d = {} as AnalyticsSummary["last30d"];
  for (const eventType of EVENT_TYPES) {
    totals[eventType] = { count: 0, units: 0 };
    last24h[eventType] = 0;
    last7d[eventType] = 0;
    last30d[eventType] = 0;
  }
  for (const row of rows) {
    totals[row.event_type] = {
      count: Number(row.all_time_count),
      units: Number(row.all_time_units ?? 0),
    };
    last24h[row.event_type] = Number(row.d1_count);
    last7d[row.event_type] = Number(row.d7_count);
    last30d[row.event_type] = Number(row.d30_count);
  }

  const { rows: activityRows } = await db().query<{ dau: string; wau: string; mau: string }>(
    `SELECT
       count(DISTINCT address) FILTER (WHERE activity_date = current_date)::text AS dau,
       count(DISTINCT address) FILTER (WHERE activity_date > current_date - 7)::text AS wau,
       count(DISTINCT address) FILTER (WHERE activity_date > current_date - 30)::text AS mau
     FROM wallet_daily_activity`,
  );
  const activity = activityRows[0];

  const { rows: newWalletRows } = await db().query<{ count: string }>(
    `SELECT count(*)::text AS count FROM (
       SELECT address, min(activity_date) AS first_seen
       FROM wallet_daily_activity
       GROUP BY address
     ) w WHERE first_seen = current_date`,
  );

  return {
    totals,
    last24h,
    last7d,
    last30d,
    dau: Number(activity?.dau ?? 0),
    wau: Number(activity?.wau ?? 0),
    mau: Number(activity?.mau ?? 0),
    newWalletsToday: Number(newWalletRows[0]?.count ?? 0),
  };
}

export interface MarketBreakdownRow {
  marketId: number;
  question: string | null;
  category: string | null;
  betsPlaced: number;
  volumeYes: number;
  volumeNo: number;
  redeemedPayout: number;
  settledYes: number | null;
  settledNo: number | null;
  percentClaimed: number | null;
}

export async function getMarketBreakdown(): Promise<MarketBreakdownRow[]> {
  const { rows } = await db().query<{
    market_id: number;
    question: string | null;
    category: string | null;
    bets_placed: string;
    volume_yes: string | null;
    volume_no: string | null;
    redeemed_payout: string | null;
    settled_yes: string | null;
    settled_no: string | null;
  }>(
    `SELECT
       e.market_id,
       m.question,
       m.category,
       count(*) FILTER (WHERE e.event_type = 'bet_placed')::text AS bets_placed,
       sum(e.units) FILTER (WHERE e.event_type = 'bet_placed' AND e.outcome_side = 'yes')::text AS volume_yes,
       sum(e.units) FILTER (WHERE e.event_type = 'bet_placed' AND e.outcome_side = 'no')::text AS volume_no,
       sum(e.units) FILTER (WHERE e.event_type = 'redeem_payout')::text AS redeemed_payout,
       sum(e.units) FILTER (WHERE e.event_type = 'market_settled' AND e.outcome_side = 'yes')::text AS settled_yes,
       sum(e.units) FILTER (WHERE e.event_type = 'market_settled' AND e.outcome_side = 'no')::text AS settled_no
     FROM analytics_events e
     LEFT JOIN markets m ON m.id = e.market_id
     WHERE e.market_id IS NOT NULL
     GROUP BY e.market_id, m.question, m.category
     ORDER BY e.market_id`,
  );

  return rows.map((row) => {
    const settledYes = row.settled_yes !== null ? Number(row.settled_yes) : null;
    const settledNo = row.settled_no !== null ? Number(row.settled_no) : null;
    const redeemedPayout = Number(row.redeemed_payout ?? 0);
    const settledTotal = (settledYes ?? 0) + (settledNo ?? 0);
    return {
      marketId: row.market_id,
      question: row.question,
      category: row.category,
      betsPlaced: Number(row.bets_placed),
      volumeYes: Number(row.volume_yes ?? 0),
      volumeNo: Number(row.volume_no ?? 0),
      redeemedPayout,
      settledYes,
      settledNo,
      percentClaimed: settledTotal > 0 ? redeemedPayout / settledTotal : null,
    };
  });
}

export type TimeSeriesMetric = "bets" | "volume" | "dau";

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

const METRIC_EVENT_TYPE: Record<"bets" | "volume", AnalyticsEventType> = {
  bets: "bet_placed",
  volume: "bet_placed",
};

export async function getTimeSeries(metric: TimeSeriesMetric, days: number): Promise<TimeSeriesPoint[]> {
  const clampedDays = Math.min(Math.max(days, 1), 365);

  if (metric === "dau") {
    const { rows } = await db().query<{ date: string; value: string }>(
      `SELECT activity_date::text AS date, count(DISTINCT address)::text AS value
       FROM wallet_daily_activity
       WHERE activity_date > current_date - ($1 || ' days')::interval
       GROUP BY activity_date
       ORDER BY activity_date`,
      [clampedDays],
    );
    return rows.map((r) => ({ date: r.date, value: Number(r.value) }));
  }

  const eventType = METRIC_EVENT_TYPE[metric];
  const column = metric === "volume" ? "sum(units)" : "count(*)";
  const { rows } = await db().query<{ date: string; value: string | null }>(
    `SELECT date_trunc('day', created_at)::date::text AS date, ${column}::text AS value
     FROM analytics_events
     WHERE event_type = $1 AND created_at > now() - ($2 || ' days')::interval
     GROUP BY date
     ORDER BY date`,
    [eventType, clampedDays],
  );
  return rows.map((r) => ({ date: r.date, value: Number(r.value ?? 0) }));
}
