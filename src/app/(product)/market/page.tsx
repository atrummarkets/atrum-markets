"use client";

import { useRouter } from "next/navigation";
import { color, font } from "@/lib/atrum/theme";
import { formatCountdown } from "@/lib/atrum/format";
import { useMarket } from "@/lib/atrum/marketContext";
import OddsBoard from "@/components/atrum/market/OddsBoard";
import AnonymityPanel from "@/components/atrum/market/AnonymityPanel";
import InfoTiles from "@/components/atrum/market/InfoTiles";
import RefusalCard from "@/components/atrum/market/RefusalCard";
import BetTicket from "@/components/atrum/market/BetTicket";
import RedeemCard from "@/components/atrum/market/RedeemCard";

export default function MarketPage() {
  const router = useRouter();
  const { market, anonymitySet, anonymityOk, side, denom, cached, pickSide, pickDenom, seal } = useMarket();
  const resolved = market.phase === "resolved";
  const showRefusal = !resolved && !anonymityOk;
  const showTicket = !resolved && anonymityOk;
  const showRedeem = resolved;

  return (
    <main style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 464px", alignItems: "start", minHeight: "calc(100vh - 64px)" }}>
      <section style={{ padding: "96px 64px 128px", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 24, alignItems: "center", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 32 }}>
          <span style={{ fontFamily: font.mono, letterSpacing: "0.06em", color: color.pewter }}>{market.marketId}</span>
          <span style={{ width: 1, height: 11, background: color.iron }} />
          <span>Parimutuel</span>
          <span style={{ width: 1, height: 11, background: color.iron }} />
          <span style={{ color: resolved ? color.halo : color.smoke }}>{resolved ? "Settled" : "Open"}</span>
        </div>

        <h1
          style={{
            fontFamily: font.display,
            fontWeight: 400,
            fontSize: "clamp(38px,5.4vw,68px)",
            lineHeight: 0.98,
            letterSpacing: "0.02em",
            color: color.ivory,
            margin: "0 0 64px",
            maxWidth: "22ch",
          }}
        >
          {market.question}
        </h1>

        {resolved && (
          <div style={{ marginBottom: 64 }}>
            <div style={{ height: 1, background: color.halo, transformOrigin: "left", animation: "atrum-aperture 900ms cubic-bezier(0.16,1,0.30,1)" }} />
            <div style={{ padding: "32px 0", animation: "atrum-rise 900ms cubic-bezier(0.16,1,0.30,1)" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.halo, marginBottom: 24 }}>
                Resolved
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 32, flexWrap: "wrap" }}>
                <span style={{ fontFamily: font.display, fontWeight: 400, fontSize: "clamp(48px,8vw,112px)", lineHeight: 0.86, letterSpacing: "0.02em", color: color.ivory }}>
                  {market.outcome}
                </span>
                <span style={{ fontSize: 20, color: color.pewter, maxWidth: "34ch" }}>
                  Pyth reported on-chain at block <span style={{ fontFamily: font.mono }}>18,442,907</span>. No appeal, no
                  house discretion, no exceptions.
                </span>
              </div>
            </div>
            <div style={{ height: 1, background: color.hairline }} />
          </div>
        )}

        <OddsBoard resolved={resolved} yesPct={market.oddsYesPct} />

        <div style={{ display: "flex", gap: 96, flexWrap: "wrap", padding: "48px 0", borderBottom: `1px solid ${color.hairline}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>
              {resolved ? "Resolved" : "Closes in"}
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 24, color: color.bone, letterSpacing: "0.02em" }}>
              {resolved ? market.resolvedAt : formatCountdown(market.closesInSeconds)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>Pool</div>
            <div style={{ fontFamily: font.mono, fontSize: 24, color: color.bone, letterSpacing: "0.02em" }}>{market.pool}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>Oracle</div>
            <div style={{ fontSize: 24, fontFamily: font.display, letterSpacing: "0.02em", color: color.pewter }}>Pyth · on-chain</div>
          </div>
        </div>

        <AnonymityPanel anonymitySet={anonymitySet} ok={anonymityOk} />
        <InfoTiles />
      </section>

      <aside
        style={{
          position: "sticky",
          top: 64,
          background: color.basalt,
          borderLeft: `1px solid ${color.hairline}`,
          minHeight: "calc(100vh - 64px)",
          padding: "48px 32px",
        }}
      >
        {showRefusal && <RefusalCard anonymitySet={anonymitySet} onGoBoundary={() => router.push("/boundary")} />}
        {showTicket && (
          <BetTicket side={side} denom={denom} cached={cached} onPickSide={pickSide} onPickDenom={pickDenom} onSeal={seal} />
        )}
        {showRedeem && <RedeemCard onGoNotes={() => router.push("/notes")} />}
      </aside>
    </main>
  );
}
