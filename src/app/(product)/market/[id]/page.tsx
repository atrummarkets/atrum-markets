"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { color, font } from "@/lib/atrum/theme";
import { formatCountdown, formatBytes, addressUrl } from "@/lib/atrum/format";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import OddsBoard from "@/components/atrum/market/OddsBoard";
import AnonymityPanel from "@/components/atrum/market/AnonymityPanel";
import BetTicket from "@/components/atrum/market/BetTicket";
import AdminPanel from "@/components/atrum/market/AdminPanel";
import Detail from "@/components/atrum/ui/Detail";
import CountdownBar from "@/components/atrum/ui/CountdownBar";
import TextReveal from "@/components/atrum/ui/motion/TextReveal";
import AnimatedBeam from "@/components/atrum/ui/motion/AnimatedBeam";

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const marketId = Number(id);

  const { markets, pool, notes, config, error } = useMarket();
  const { session } = useWallet();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const explainerGridRef = useRef<HTMLDivElement>(null);
  const relayerTileRef = useRef<HTMLDivElement>(null);
  const proofTileRef = useRef<HTMLDivElement>(null);
  const payoutTileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const market = markets.find((m) => m.marketId === marketId);

  /** Unbet, grafted notes are the only thing that can back a bet. */
  const spendable = useMemo(
    () => notes.filter((n) => n.outcome === 0 && n.status === "grafted"),
    [notes],
  );

  if (!market) {
    return (
      <main style={{ padding: "96px 64px" }}>
        <p style={{ color: color.ash }}>
          {error ?? `Loading market #${marketId}…`}
        </p>
        <Link href="/markets" style={{ color: color.pewter, fontSize: 15 }}>
          ← All markets
        </Link>
      </main>
    );
  }

  const decided = market.phase === "resolved" || market.phase === "settled";
  const poolUnits = market.yesUnits + market.noUnits;

  return (
    <main style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 464px", alignItems: "start", minHeight: "calc(100vh - 32px)" }}>
      <section style={{ padding: "64px 64px 128px", minWidth: 0 }}>
        <Link href="/markets" style={{ fontSize: 13, color: color.ash, textDecoration: "none" }}>
          ← All markets
        </Link>

        <div style={{ display: "flex", gap: 20, alignItems: "center", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, margin: "32px 0" }}>
          <span style={{ fontFamily: font.mono, color: color.pewter }}>#{market.marketId}</span>
          <span style={{ width: 1, height: 11, background: color.iron }} />
          <span>{market.category}</span>
          <span style={{ width: 1, height: 11, background: color.iron }} />
          <span>Parimutuel</span>
          <span style={{ width: 1, height: 11, background: color.iron }} />
          <span style={{ color: decided ? color.halo : market.phase === "closed" ? color.ember : color.smoke }}>
            {market.phase === "settled" ? "Settled" : market.phase === "resolved" ? "Resolved" : market.phase === "closed" ? "Betting closed" : "Open"}
          </span>
        </div>

        <h1
          style={{
            fontFamily: font.display,
            fontWeight: 400,
            fontSize: "clamp(34px,4.6vw,58px)",
            lineHeight: 1.0,
            letterSpacing: "0.02em",
            color: color.ivory,
            margin: "0 0 56px",
            maxWidth: "22ch",
          }}
        >
          {market.question}
        </h1>

        {decided && (
          <div style={{ marginBottom: 56 }}>
            <div style={{ height: 1, background: color.halo, transformOrigin: "left", animation: "atrum-aperture 900ms cubic-bezier(0.16,1,0.30,1)" }} />
            <div style={{ padding: "28px 0" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.halo, marginBottom: 20 }}>
                {market.settled ? "Settled" : "Resolved"}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 28, flexWrap: "wrap" }}>
                <TextReveal
                  text={market.outcome}
                  className="font-display text-[clamp(44px,7vw,96px)] leading-[0.86]"
                  staggerMs={80}
                />
                <span style={{ fontSize: 18, color: color.pewter, maxWidth: "36ch" }}>
                  {market.settled
                    ? `Totals decrypted and published on chain under a Chaum-Pedersen proof: YES ${market.yesUnits}, NO ${market.noUnits}.`
                    : "Outcome recorded. Totals are still encrypted until the settlement transaction publishes them."}
                </span>
              </div>
            </div>
            <div style={{ height: 1, background: color.hairline }} />
          </div>
        )}

        <OddsBoard market={market} />

        <div style={{ display: "flex", gap: 80, flexWrap: "wrap", padding: "40px 0", borderBottom: `1px solid ${color.hairline}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>
              {market.phase === "betting" ? "Betting closes in" : "Betting"}
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 22, color: color.bone }}>
              {market.phase === "betting" ? formatCountdown(market.bettingCloseTime - now) : "closed"}
            </div>
            {market.phase === "betting" && (
              <CountdownBar closeTime={market.bettingCloseTime} now={now} className="w-40" />
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>Pool</div>
            <div style={{ fontFamily: font.mono, fontSize: 22, color: color.bone }}>{poolUnits} units</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>Vault</div>
            <a
              href={addressUrl(market.vault)}
              target="_blank"
              rel="noreferrer"
              style={{ fontFamily: font.mono, fontSize: 15, color: color.pewter, textDecoration: "none", borderBottom: `1px solid ${color.hairline}` }}
            >
              {market.vault.slice(0, 10)}…{market.vault.slice(-6)}
            </a>
          </div>
        </div>

        {pool && <AnonymityPanel pool={pool} />}

        {config && (
          <div style={{ marginTop: 56 }}>
            <Detail summary="How a trade on this market stays private">
              <div
                ref={explainerGridRef}
                style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                  gap: 1,
                  background: color.hairline,
                  border: `1px solid ${color.hairline}`,
                }}
              >
                <AnimatedBeam containerRef={explainerGridRef} fromRef={relayerTileRef} toRef={proofTileRef} />
                <AnimatedBeam containerRef={explainerGridRef} fromRef={proofTileRef} toRef={payoutTileRef} />
                <div ref={relayerTileRef} style={{ background: color.void, padding: 28 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 14 }}>
                    The relayer
                  </div>
                  <p style={{ margin: 0, fontSize: 15, color: color.smoke }}>
                    Your bet is submitted by a relayer, so your address never appears beside it on chain. The
                    relayer knows it was you — trust is relocated, not removed.
                  </p>
                </div>
                <div ref={proofTileRef} style={{ background: color.void, padding: 28 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 14 }}>
                    The proof
                  </div>
                  <p style={{ margin: 0, fontSize: 15, color: color.smoke }}>
                    A bet proves {config.circuits.bet.constraints.toLocaleString()} constraints against a{" "}
                    {formatBytes(config.circuits.bet.zkeyBytes)} proving key. It runs on this server, which
                    therefore sees your note secrets — the production design proves in your browser instead.
                  </p>
                </div>
                <div ref={payoutTileRef} style={{ background: color.void, padding: 28 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 14 }}>
                    The payout
                  </div>
                  <p style={{ margin: 0, fontSize: 15, color: color.smoke }}>
                    Redeeming pays into a shielded note; no collateral moves and nothing is published. Withdrawing
                    is a separate, public step, taken whenever you like.
                  </p>
                </div>
              </div>
            </Detail>
          </div>
        )}

        <AdminPanel market={market} now={now} />
      </section>

      <aside
        style={{
          position: "sticky",
          top: 32,
          background: color.basalt,
          borderLeft: `1px solid ${color.hairline}`,
          minHeight: "calc(100vh - 32px)",
          padding: "40px 32px",
        }}
      >
        <BetTicket market={market} spendable={spendable} signedIn={!!session} />
      </aside>
    </main>
  );
}
