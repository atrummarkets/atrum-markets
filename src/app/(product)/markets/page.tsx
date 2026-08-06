"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { color, font } from "@/lib/atrum/theme";
import { formatCountdown } from "@/lib/atrum/format";
import { useMarket } from "@/lib/atrum/marketContext";
import type { LiveMarket } from "@/lib/atrum/api";
import Shimmer from "@/components/atrum/ui/motion/Shimmer";
import AnimatedList from "@/components/atrum/ui/motion/AnimatedList";
import CardGlow from "@/components/atrum/ui/CardGlow";
import CountdownBar from "@/components/atrum/ui/CountdownBar";

function PhaseTag({ m }: { m: LiveMarket }) {
  const map = {
    betting: { label: "Open", c: color.ivory },
    closed: { label: "Betting closed", c: color.ember },
    resolved: { label: `Resolved ${m.outcome}`, c: color.halo },
    settled: { label: `Settled ${m.outcome}`, c: color.halo },
  } as const;
  const { label, c } = map[m.phase];
  return (
    <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: c }}>{label}</span>
  );
}

function Card({ m, now }: { m: LiveMarket; now: number }) {
  const pool = m.yesUnits + m.noUnits;
  const open = m.phase === "betting";

  return (
    <Link
      href={`/market/${m.marketId}`}
      className="group relative flex flex-col justify-between gap-8 overflow-hidden border border-hairline bg-basalt p-8 text-bone no-underline transition-[transform,border-color] duration-control ease-control hover:-translate-y-1 hover:border-hairlineStrong"
      style={{ minHeight: 260, borderRadius: 2 }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
      }}
    >
      <CardGlow />
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>
            {m.category}
          </span>
          <PhaseTag m={m} />
        </div>
        <div
          style={{
            fontFamily: font.display,
            fontSize: 26,
            lineHeight: 1.1,
            letterSpacing: "0.01em",
            color: color.ivory,
          }}
        >
          {m.question}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
          <span style={{ fontFamily: font.mono, fontWeight: 300, fontSize: 44, lineHeight: 1, color: color.ivory }}>
            {m.oddsYesPct}
          </span>
          <span style={{ fontFamily: font.display, fontSize: 16, letterSpacing: "0.16em", color: color.ivory }}>YES</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: font.mono, fontSize: 20, color: color.ash }}>{100 - m.oddsYesPct}</span>
          <span style={{ fontFamily: font.display, fontSize: 14, letterSpacing: "0.16em", color: color.ash }}>NO</span>
        </div>

        <div style={{ display: "flex", gap: 2, height: 6, marginBottom: 20 }}>
          <div style={{ background: color.ivory, width: `${m.oddsYesPct}%` }} />
          <div style={{ background: color.iron, flex: 1 }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: color.smoke }}>
          <span>
            Pool <span style={{ fontFamily: font.mono, color: color.pewter }}>{pool}</span> units
          </span>
          <span style={{ fontFamily: font.mono, color: open ? color.pewter : color.ash }}>
            {open ? formatCountdown(m.bettingCloseTime - now) : "—"}
          </span>
        </div>
        {open && <CountdownBar closeTime={m.bettingCloseTime} now={now} className="mt-2" />}
      </div>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <Shimmer className="flex flex-col justify-between gap-8 p-8" style={{ minHeight: 260 }}>
      <div className="flex flex-col gap-5">
        <div className="h-3 w-24 bg-hairline" />
        <div className="h-6 w-4/5 bg-hairline" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-9 w-32 bg-hairline" />
        <div className="h-1.5 w-full bg-hairline" />
      </div>
    </Shimmer>
  );
}

export default function MarketsPage() {
  const { markets, error } = useMarket();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <main style={{ padding: "80px 64px 128px", maxWidth: 1400, margin: "0 auto" }}>
      <h1
        style={{
          fontFamily: font.display,
          fontWeight: 400,
          fontSize: "clamp(32px,4vw,54px)",
          letterSpacing: "0.02em",
          color: color.ivory,
          margin: "0 0 16px",
        }}
      >
        Markets
      </h1>
      <p style={{ margin: "0 0 32px", fontSize: 19, color: color.smoke, maxWidth: "62ch" }}>
        The odds are public. Your position is not. Every stake is encrypted on chain and only ever added to a
        total — nobody, including us, sees what you staked until the market settles.
      </p>

      {error && (
        <div style={{ marginBottom: 32, padding: 20, border: `1px solid ${color.ember}`, color: color.ember, fontSize: 15 }}>
          {error}
        </div>
      )}

      {markets.length === 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 20 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <AnimatedList
          items={markets}
          keyExtractor={(m) => String(m.marketId)}
          renderItem={(m) => <Card m={m} now={now} />}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 20 }}
          staggerMs={60}
        />
      )}
    </main>
  );
}
