"use client";

import { useCallback, useEffect, useState } from "react";
import { color, font } from "@/lib/atrum/theme";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import Sparkline from "@/components/atrum/ui/Sparkline";

/**
 * Operator-only aggregate metrics: how many wallets, how many bets, how much volume, how much
 * paid out. Nothing here ever pairs a wallet address with an amount, a market, or a side --
 * see the "HARD RULE" comment in src/server/atrum/analytics.ts. This page reads only the
 * aggregate endpoints under /api/atrum/admin/analytics/*, which enforce that server-side; the
 * operator check below is presentation only, same posture as the parent /status page.
 */

interface AnalyticsSummary {
  totals: Record<string, { count: number; units: number }>;
  last24h: Record<string, number>;
  last7d: Record<string, number>;
  dau: number;
  wau: number;
  mau: number;
  newWalletsToday: number;
}

interface MarketRow {
  marketId: number;
  question: string | null;
  betsPlaced: number;
  volumeYes: number;
  volumeNo: number;
  redeemedPayout: number;
  settledYes: number | null;
  settledNo: number | null;
  percentClaimed: number | null;
}

const POLL_MS = 60000;

const panel: React.CSSProperties = {
  border: `1px solid ${color.hairline}`,
  padding: 20,
  marginBottom: 20,
};

const label: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  color: color.ash,
  marginBottom: 12,
};

function kpiRow(rows: { label: string; value: string }[]) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ fontSize: 11, color: color.ash, marginBottom: 4 }}>{r.label}</div>
          <div style={{ fontSize: 22, fontFamily: font.mono, color: color.ivory }}>{r.value}</div>
        </div>
      ))}
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `${url} -> ${res.status}`);
  return body as T;
}

export default function AnalyticsPage() {
  const { config } = useMarket();
  const { session } = useWallet();

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [betsTrend, setBetsTrend] = useState<number[]>([]);
  const [volumeTrend, setVolumeTrend] = useState<number[]>([]);
  const [dauTrend, setDauTrend] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isOperator =
    !!session && !!config?.operator && session.toLowerCase() === config.operator.toLowerCase();

  const load = useCallback(async () => {
    if (!isOperator) return;
    try {
      const [summaryBody, marketsBody, betsBody, volumeBody, dauBody] = await Promise.all([
        fetchJson<AnalyticsSummary>("/api/atrum/admin/analytics/summary"),
        fetchJson<{ markets: MarketRow[] }>("/api/atrum/admin/analytics/markets"),
        fetchJson<{ points: { value: number }[] }>("/api/atrum/admin/analytics/timeseries?metric=bets&days=30"),
        fetchJson<{ points: { value: number }[] }>("/api/atrum/admin/analytics/timeseries?metric=volume&days=30"),
        fetchJson<{ points: { value: number }[] }>("/api/atrum/admin/analytics/timeseries?metric=dau&days=30"),
      ]);
      setSummary(summaryBody);
      setMarkets(marketsBody.markets);
      setBetsTrend(betsBody.points.map((p) => p.value));
      setVolumeTrend(volumeBody.points.map((p) => p.value));
      setDauTrend(dauBody.points.map((p) => p.value));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [isOperator]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  if (!isOperator) {
    return (
      <main style={{ padding: 48, maxWidth: 860, margin: "0 auto", fontFamily: font.body }}>
        <p style={{ color: color.ash, fontSize: 14 }}>Operator only.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 48, maxWidth: 1000, margin: "0 auto", fontFamily: font.body }}>
      <h1 style={{ fontSize: 28, marginBottom: 8, color: color.ivory }}>Analytics</h1>
      <p style={{ color: color.smoke, fontSize: 14, marginBottom: 32 }}>
        Aggregate only. No row here ever links a wallet to a bet amount or payout.
      </p>

      {error && (
        <div style={{ ...panel, borderColor: color.ember, color: color.ember }}>
          Could not load analytics: {error}
        </div>
      )}

      {summary && (
        <>
          <div style={panel}>
            <div style={label}>Wallets</div>
            {kpiRow([
              { label: "DAU", value: String(summary.dau) },
              { label: "WAU", value: String(summary.wau) },
              { label: "MAU", value: String(summary.mau) },
              { label: "New today", value: String(summary.newWalletsToday) },
            ])}
          </div>

          <div style={panel}>
            <div style={label}>Activity, all-time</div>
            {kpiRow([
              { label: "Bets placed", value: summary.totals.bet_placed?.count.toLocaleString() ?? "0" },
              { label: "Volume wagered", value: summary.totals.bet_placed?.units.toLocaleString() ?? "0" },
              { label: "Deposited", value: summary.totals.deposit_confirmed?.units.toLocaleString() ?? "0" },
              { label: "Withdrawn", value: summary.totals.withdrawal?.units.toLocaleString() ?? "0" },
              { label: "Redeemed", value: summary.totals.redeem_payout?.units.toLocaleString() ?? "0" },
              { label: "Settled payout", value: summary.totals.market_settled?.units.toLocaleString() ?? "0" },
            ])}
          </div>

          <div style={{ ...panel, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
            <div>
              <div style={label}>Bets / day, last 30d</div>
              <Sparkline points={betsTrend} width={220} height={40} />
            </div>
            <div>
              <div style={label}>Volume / day, last 30d</div>
              <Sparkline points={volumeTrend} width={220} height={40} />
            </div>
            <div>
              <div style={label}>DAU, last 30d</div>
              <Sparkline points={dauTrend} width={220} height={40} />
            </div>
          </div>
        </>
      )}

      <div style={panel}>
        <div style={label}>Per-market</div>
        {markets.length === 0 ? (
          <div style={{ color: color.smoke, fontSize: 14 }}>No activity recorded yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: color.ash, textAlign: "left" }}>
                  <th style={{ padding: "6px 8px" }}>Market</th>
                  <th style={{ padding: "6px 8px" }}>Bets</th>
                  <th style={{ padding: "6px 8px" }}>Volume YES</th>
                  <th style={{ padding: "6px 8px" }}>Volume NO</th>
                  <th style={{ padding: "6px 8px" }}>Redeemed</th>
                  <th style={{ padding: "6px 8px" }}>Settled</th>
                  <th style={{ padding: "6px 8px" }}>% claimed</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((m) => (
                  <tr key={m.marketId} style={{ borderTop: `1px solid ${color.hairline}`, color: color.bone }}>
                    <td style={{ padding: "8px" }}>
                      #{m.marketId} {m.question ?? ""}
                    </td>
                    <td style={{ padding: "8px", fontFamily: font.mono }}>{m.betsPlaced}</td>
                    <td style={{ padding: "8px", fontFamily: font.mono }}>{m.volumeYes.toLocaleString()}</td>
                    <td style={{ padding: "8px", fontFamily: font.mono }}>{m.volumeNo.toLocaleString()}</td>
                    <td style={{ padding: "8px", fontFamily: font.mono }}>{m.redeemedPayout.toLocaleString()}</td>
                    <td style={{ padding: "8px", fontFamily: font.mono }}>
                      {m.settledYes === null ? "—" : (m.settledYes + (m.settledNo ?? 0)).toLocaleString()}
                    </td>
                    <td style={{ padding: "8px", fontFamily: font.mono }}>
                      {m.percentClaimed === null ? "—" : `${(m.percentClaimed * 100).toFixed(0)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
