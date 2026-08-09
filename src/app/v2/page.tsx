"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { c, line, fill, font } from "@/lib/atrum/v2/tokens";
import { impliedYesPct, centsFor, closesIn } from "@/lib/atrum/v2/odds";
import { useMarket } from "@/lib/atrum/marketContext";
import type { LiveMarket } from "@/lib/atrum/api";

/**
 * The floor.
 *
 * Every figure here is live: odds are the real pool split, the close time is the vault's
 * `bettingCloseTime`, and a row flashes when its odds actually move rather than on a timer.
 * The prototype animated random drift to look alive; a market that appears to move when nothing
 * has happened is the most basic way a trading interface can lie.
 */

const HINT_KEY = "atrum:v2:hint-dismissed";

function MarketRow({ market, flash }: { market: LiveMarket; flash: boolean }) {
  const yesPct = impliedYesPct(market);
  const total = market.yesUnits + market.noUnits;

  return (
    <Link
      href={`/v2/market/${market.marketId}`}
      style={{
        display: "block",
        border: `1px solid ${line.soft}`,
        background: flash ? c.panelFlash : c.panel,
        borderRadius: 10,
        padding: "18px 20px",
        textDecoration: "none",
        color: c.text,
        transition: "border-color .2s, background .6s",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: font.mono,
            fontSize: 10,
            letterSpacing: "0.12em",
            color: c.faint,
            border: `1px solid ${line.base}`,
            padding: "2px 7px",
            borderRadius: 4,
          }}
        >
          {market.category.toUpperCase()}
        </span>
        <span style={{ fontSize: 15, fontWeight: 500, flex: 1, minWidth: 200 }}>{market.question}</span>
        <span style={{ fontFamily: font.mono, fontSize: 11.5, color: c.dim }}>
          closes {closesIn(market.bettingCloseTime)}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontFamily: font.mono, fontSize: 13, color: c.green, width: 76 }}>YES {centsFor(yesPct)}</span>
        <div style={{ flex: 1, height: 5, borderRadius: 3, background: fill.redTrack, overflow: "hidden", position: "relative" }}>
          <div
            style={{
              position: "absolute",
              inset: "0 auto 0 0",
              width: `${yesPct}%`,
              background: "linear-gradient(90deg,rgba(61,190,139,.55),rgba(61,190,139,.9))",
              transition: "width 1.1s cubic-bezier(.4,0,.2,1)",
            }}
          />
        </div>
        <span style={{ fontFamily: font.mono, fontSize: 13, color: c.red, width: 70, textAlign: "right" }}>
          NO {centsFor(100 - yesPct)}
        </span>
      </div>

      {/*
        An empty market says so rather than showing 50/50 as though it were a considered price.
        Fifty-fifty on no volume is the absence of information, not a market view.
      */}
      {total === 0 && (
        <div style={{ fontFamily: font.mono, fontSize: 10.5, color: c.faint, marginTop: 10 }}>
          NO BETS YET — ODDS OPEN
        </div>
      )}
    </Link>
  );
}

export default function V2MarketsPage() {
  const { markets, pool } = useMarket();
  const [hint, setHint] = useState(false);
  const [flash, setFlash] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Deferred by a tick: localStorage is unavailable during SSR so this cannot be an initial
    // state value, and setting it inline forces an extra render pass before paint.
    const id = setTimeout(() => setHint(window.localStorage.getItem(HINT_KEY) !== "1"), 0);
    return () => clearTimeout(id);
  }, []);

  /*
    Flash a row only when its odds GENUINELY changed between polls.

    The prototype drifted every market on a timer so the floor looked alive. A market that
    appears to move when nothing happened is the most basic way a trading interface can lie, so
    this compares against the previous poll and flashes only real movement -- which means a
    quiet market correctly sits still.

    Previous odds live in a ref, not state: they are bookkeeping between renders, and holding
    them in state would schedule a second render for every poll that changed nothing.
  */
  const prevOdds = useRef<Record<number, number>>({});
  useEffect(() => {
    const changed: Record<number, boolean> = {};
    for (const m of markets) {
      const pct = impliedYesPct(m);
      const before = prevOdds.current[m.marketId];
      if (before !== undefined && before !== pct) changed[m.marketId] = true;
      prevOdds.current[m.marketId] = pct;
    }
    if (Object.keys(changed).length === 0) return;

    const on = setTimeout(() => setFlash(changed), 0);
    const off = setTimeout(() => setFlash({}), 800);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [markets]);

  const open = markets.filter((m) => m.phase === "betting");
  const decided = markets.filter((m) => m.phase !== "betting");

  return (
    <main style={{ maxWidth: 880, width: "100%", margin: "0 auto", padding: "36px 24px 80px", animation: "v2FadeIn .3s ease" }}>
      {hint && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: `1px solid ${line.goldSoft}`,
            background: fill.goldFaint,
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 28,
          }}
        >
          <div style={{ width: 8, height: 8, background: c.gold, transform: "rotate(45deg)", flexShrink: 0 }} />
          <div style={{ fontSize: 13.5, color: c.bright, flex: 1 }}>
            New here? Your first bet walks you through every step — deposit, batch, prove, seal, receipt. No reading
            required.
          </div>
          <button
            onClick={() => {
              window.localStorage.setItem(HINT_KEY, "1");
              setHint(false);
            }}
            style={{ background: "none", border: "none", color: c.faint, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>The floor</h1>
        <div style={{ fontFamily: font.mono, fontSize: 11, color: c.faint }}>
          {pool ? `${pool.totalDeposits} NOTES IN THE SET` : "MONAD TESTNET"}
        </div>
      </div>
      <p style={{ color: c.dim, fontSize: 13.5, margin: "0 0 28px" }}>Odds are public. Positions never are.</p>

      {markets.length === 0 ? (
        <div style={{ padding: 64, border: `1px solid ${line.soft}`, borderRadius: 10, textAlign: "center", color: c.dim }}>
          Loading the floor…
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {open.map((m) => (
            <MarketRow key={m.marketId} market={m} flash={!!flash[m.marketId]} />
          ))}

          {decided.length > 0 && (
            <>
              <div style={{ fontFamily: font.mono, fontSize: 10.5, letterSpacing: "0.14em", color: c.faint, margin: "22px 0 4px" }}>
                DECIDED
              </div>
              {decided.map((m) => (
                <Link
                  key={m.marketId}
                  href={`/v2/market/${m.marketId}`}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                    flexWrap: "wrap",
                    border: `1px solid ${line.faint}`,
                    borderRadius: 10,
                    padding: "14px 20px",
                    textDecoration: "none",
                    color: c.dim,
                  }}
                >
                  <span style={{ fontSize: 14, flex: 1, minWidth: 200 }}>{m.question}</span>
                  <span
                    style={{
                      fontFamily: font.mono,
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      color: m.outcome === "YES" ? c.green : m.outcome === "NO" ? c.red : c.faint,
                    }}
                  >
                    {m.settled ? m.outcome : m.phase.toUpperCase()}
                  </span>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </main>
  );
}
