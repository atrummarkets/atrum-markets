"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { color, font, space } from "@/lib/atrum/theme";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import { useDetailMode } from "@/lib/atrum/detailMode";
import { txUrl, shortHash } from "@/lib/atrum/format";
import type { LiveNote, LiveMarket } from "@/lib/atrum/api";
import WithdrawDialog from "@/components/atrum/WithdrawDialog";
import AnimatedList from "@/components/atrum/ui/motion/AnimatedList";
import NumberTicker from "@/components/atrum/ui/motion/NumberTicker";
import { useState } from "react";

const COLUMNS = "150px 1fr 130px 150px 200px";

/**
 * What a winning note actually pays.
 *
 * WHY THIS IS ON SCREEN. A won position holds its STAKE until it is redeemed -- a 10-unit bet
 * shows "10" whether it doubled or tripled -- so the row read "you won" next to the number 10
 * and the natural conclusion was "I won and got 10 back". The payout was only discoverable by
 * committing to the redeem. Someone hit exactly that confusion on a 3.26x win.
 *
 * `units * totalPool / winningPool`, truncated DOWN, is the same arithmetic
 * `redeem_private.circom` constrains (`units * totalPool == payout * winningPool + remainder`).
 * BigInt, not floats: this must agree with the circuit exactly or the number shown is a lie.
 * Truncating down is what keeps the sum of all payouts strictly under the pool.
 */
function winningPayout(note: LiveNote, market: LiveMarket | undefined): bigint | null {
  if (!market?.settled) return null;
  const totalPool = BigInt(market.yesUnits + market.noUnits);
  const winningPool = BigInt(note.outcome === 1 ? market.yesUnits : market.noUnits);
  if (winningPool === 0n) return null;
  return (BigInt(note.units) * totalPool) / winningPool;
}

/** Every state a note can be in, derived from real fields -- never invented. Two altitudes of
 * the same derivation: simple plain-English state for a Polymarket-style trader, the exact
 * protocol state for anyone who's flipped to Detailed. */
function describe(
  note: LiveNote,
  settledMarkets: Set<string>,
  winners: Set<string>,
  payout: bigint | null,
) {
  if (note.status === "spent") {
    return {
      simpleState: "USED",
      detailedState: "SPENT",
      simpleDetail: "Already used.",
      detailedDetail: "Already used. Its nullifier is on chain.",
      action: null,
      tone: color.smoke,
    };
  }
  if (note.status === "queued") {
    const building = !note.txHash;
    return {
      simpleState: "PENDING",
      detailedState: "QUEUED",
      simpleDetail: building ? "Getting ready." : "Joining the shared pool — a brief wait.",
      detailedDetail: building ? "Building — not yet broadcast." : "On chain, waiting for the next batch graft.",
      action: null,
      tone: color.ash,
    };
  }
  // grafted
  if (note.outcome === 0) {
    return {
      simpleState: "BALANCE",
      detailedState: "COLLATERAL",
      simpleDetail: "Ready to trade with, or send back out.",
      detailedDetail: "In the tree. Can back a bet in any market, or exit.",
      action: "bet" as const,
      tone: color.pewter,
    };
  }
  if (note.outcome === 3) {
    return {
      simpleState: "WINNINGS",
      detailedState: "SETTLED",
      simpleDetail: "Ready to send to your wallet — later is quieter.",
      detailedDetail: "A payout note. Withdraw whenever you like — later is quieter.",
      action: "withdraw" as const,
      tone: color.halo,
    };
  }
  const side = note.outcome === 1 ? "YES" : "NO";
  if (!settledMarkets.has(note.marketId)) {
    return {
      simpleState: `${side} · PENDING`,
      simpleDetail: "Waiting on this market to settle.",
      detailedState: `${side} · OPEN`,
      detailedDetail: `Sealed in market #${note.marketId}. Nothing about it is public until settlement.`,
      action: null,
      tone: color.ivory,
    };
  }
  if (winners.has(`${note.marketId}:${note.outcome}`)) {
    // State the payout in both altitudes. The stake is what the row shows in Units, and
    // leaving the reader to infer their winnings from it is how a 3.26x win reads as a
    // break-even.
    const worth = payout === null ? "" : ` Worth ${payout} units.`;
    return {
      simpleState: `${side} · WON`,
      simpleDetail: `Claim it, then send it out whenever you like.${worth}`,
      detailedState: `${side} · WON`,
      detailedDetail:
        `Redeeming pays into a shielded note of ${payout ?? "?"} units. No collateral moves.`,
      action: "redeem" as const,
      tone: color.halo,
    };
  }
  return {
    simpleState: `${side} · LOST`,
    simpleDetail: "This market went the other way.",
    detailedState: `${side} · LOST`,
    detailedDetail: `Market #${note.marketId} resolved the other way.`,
    action: null,
    tone: color.smoke,
  };
}

const ACTION_LABEL: Record<"bet" | "redeem" | "withdraw", { simple: string; detailed: string }> = {
  bet: { simple: "Trade", detailed: "bet" },
  redeem: { simple: "Claim", detailed: "redeem" },
  withdraw: { simple: "Send", detailed: "withdraw" },
};

export default function PortfolioPage() {
  const router = useRouter();
  const { notes, markets, activity, error, clearError, redeem } = useMarket();
  const { session, connect, connecting } = useWallet();
  const { mode } = useDetailMode();
  const [withdrawing, setWithdrawing] = useState<LiveNote | null>(null);

  const settledMarkets = new Set(markets.filter((m) => m.settled).map((m) => String(m.marketId)));
  const winners = new Set(
    markets
      .filter((m) => m.settled)
      .map((m) => `${m.marketId}:${m.outcome === "YES" ? 1 : 2}`),
  );

  if (!session) {
    return (
      <main style={{ padding: "96px 64px", maxWidth: 720 }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 400, fontSize: 44, color: color.ivory, margin: "0 0 16px" }}>
          Your portfolio
        </h1>
        <p style={{ margin: "0 0 32px", fontSize: 19, color: color.smoke }}>
          Connect your wallet to see it. You&apos;ll sign a message to prove the address is yours — no transaction,
          no gas.
        </p>
        <button
          onClick={() => connect()}
          disabled={connecting}
          style={{ padding: "18px 32px", border: 0, background: color.ivory, color: color.void, borderRadius: 2, cursor: "pointer", fontFamily: font.display, fontSize: 20, letterSpacing: "0.14em" }}
        >
          {connecting ? "CONNECTING…" : "CONNECT WALLET"}
        </button>
      </main>
    );
  }

  return (
    <main style={{ padding: `${space.pageYTop}px ${space.pageX}px ${space.pageYBottom}px`, maxWidth: 1300 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 32, flexWrap: "wrap", marginBottom: 16 }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 400, fontSize: "clamp(30px,3.6vw,46px)", color: color.ivory, margin: 0 }}>
          Your portfolio
        </h1>
        <Link
          href="/wallet"
          style={{ padding: "14px 28px", border: 0, background: color.ivory, color: color.void, borderRadius: 2, textDecoration: "none", fontSize: 15 }}
        >
          Add funds
        </Link>
      </div>
      <p style={{ margin: "0 0 48px", fontSize: 19, color: color.smoke, maxWidth: "62ch" }}>
        {mode === "detailed"
          ? "There is no account and no balance. You hold notes — sealed objects with states. Each state permits different things."
          : "Your balance and open positions. Each row shows what it's for and what you can do with it."}
      </p>

      {error && (
        <div style={{ marginBottom: 24, padding: 18, border: `1px solid ${color.ember}`, color: color.ember, fontSize: 15, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{error}</span>
          <button onClick={clearError} style={{ background: "none", border: 0, color: color.ash, cursor: "pointer", textDecoration: "underline" }}>
            dismiss
          </button>
        </div>
      )}

      {notes.length === 0 ? (
        <div style={{ padding: 64, border: `1px solid ${color.hairline}`, textAlign: "center" }}>
          <p style={{ margin: "0 0 24px", fontSize: 17, color: color.smoke }}>
            Nothing here yet. Add funds to get started.
          </p>
          <Link href="/wallet" style={{ color: color.halo, fontSize: 15 }}>
            Go to your wallet →
          </Link>
        </div>
      ) : (
        <div style={{ border: `1px solid ${color.hairline}` }}>
          <div
            className="sticky top-8 z-10 bg-void"
            style={{
              display: "grid",
              gridTemplateColumns: COLUMNS,
              gap: 24,
              padding: "14px 28px",
              borderBottom: `1px solid ${color.hairline}`,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: color.ash,
            }}
          >
            <span>{mode === "detailed" ? "Note" : "Item"}</span>
            <span>State</span>
            <span>Units</span>
            <span>Transaction</span>
            <span>Actions</span>
          </div>

          <AnimatedList
            items={notes}
            keyExtractor={(n) => n.id}
            staggerMs={40}
            renderItem={(n, i) => {
              const payout = winningPayout(n, markets.find((m) => String(m.marketId) === n.marketId));
              const d = describe(n, settledMarkets, winners, payout);
              // Only worth showing when redeeming actually changes the number -- a market with
              // no losers pays 1:1, and "10 -> 10" is noise dressed up as information.
              const showPayout = d.action === "redeem" && payout !== null && payout !== BigInt(n.units);
              const busy = activity?.noteId === n.id;
              const stateLabel = mode === "detailed" ? d.detailedState : d.simpleState;
              const detailLine = mode === "detailed" ? d.detailedDetail : d.simpleDetail;
              const actionLabel = d.action ? ACTION_LABEL[d.action][mode === "detailed" ? "detailed" : "simple"] : null;
              return (
                <div
                  className={`transition-colors duration-control ease-control hover:bg-graphite ${i % 2 === 1 ? "bg-basalt/40" : ""}`}
                  style={{ display: "grid", gridTemplateColumns: COLUMNS, gap: 24, padding: "24px 28px", borderBottom: `1px solid ${color.hairline}`, alignItems: "center" }}
                >
                  <span style={{ fontFamily: font.mono, fontSize: 14, color: color.pewter }}>0x{n.id}</span>
                  <div>
                    <div style={{ fontFamily: font.display, fontSize: 21, letterSpacing: "0.14em", color: d.tone }}>{stateLabel}</div>
                    <div style={{ fontSize: 13, color: color.ash, marginTop: 4 }}>{detailLine}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                    <NumberTicker
                      value={Number(n.units)}
                      className={`font-mono text-sm ${showPayout ? "text-ash line-through" : "text-bone"}`}
                      flashOnChange
                    />
                    {showPayout && (
                      <span style={{ fontFamily: font.mono, fontSize: 14, color: color.halo }}>
                        {String(payout)}
                        <span style={{ fontSize: 11, color: color.ash, marginLeft: 5 }}>
                          {(Number(payout) / Number(n.units)).toFixed(2)}x
                        </span>
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: font.mono, fontSize: 12 }}>
                    {n.txHash ? (
                      <a href={txUrl(n.txHash)} target="_blank" rel="noreferrer" style={{ color: color.ash, textDecoration: "none" }}>
                        {shortHash(n.txHash)} ↗
                      </a>
                    ) : (
                      <span style={{ color: color.iron }}>—</span>
                    )}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    {d.action === null ? (
                      <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.iron }}>—</span>
                    ) : (
                      <button
                        onClick={() => {
                          if (d.action === "bet") router.push("/markets");
                          else if (d.action === "redeem") redeem(n.id);
                          else setWithdrawing(n);
                        }}
                        disabled={!!activity}
                        style={{
                          padding: "11px 18px",
                          border: `1px solid ${d.action === "redeem" ? color.halo : color.hairlineStrong}`,
                          background: "none",
                          color: activity ? color.ash : d.action === "redeem" ? color.halo : color.bone,
                          borderRadius: 2,
                          cursor: activity ? "wait" : "pointer",
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.16em",
                        }}
                      >
                        {busy ? "Working…" : actionLabel}
                      </button>
                    )}
                    <Link
                      href={`/privacy/${n.id}`}
                      style={{ fontSize: 12, color: color.ash, textDecoration: "underline", textDecorationColor: color.hairline }}
                    >
                      How this stayed private
                    </Link>
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}

      <p style={{ margin: "28px 0 0", fontSize: 15, color: color.ash, maxWidth: "76ch" }}>
        Claiming and sending stay two separate steps. A payout is an odd number set by your stake; paying it out
        immediately would publish a figure that names your position exactly.
      </p>

      <AnimatePresence>
        {withdrawing && <WithdrawDialog note={withdrawing} onClose={() => setWithdrawing(null)} />}
      </AnimatePresence>
    </main>
  );
}
