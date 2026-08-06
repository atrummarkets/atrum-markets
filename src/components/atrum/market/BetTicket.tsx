"use client";

import { useState } from "react";
import Link from "next/link";
import { color, font, motion } from "@/lib/atrum/theme";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import { useDetailMode } from "@/lib/atrum/detailMode";
import type { LiveMarket, LiveNote } from "@/lib/atrum/api";
import PillButton from "@/components/atrum/ui/PillButton";
import StatRow from "@/components/atrum/ui/StatRow";
import Detail from "@/components/atrum/ui/Detail";
import ShineButton from "@/components/atrum/ui/motion/ShineButton";

type Side = "yes" | "no";

export default function BetTicket({
  market,
  spendable,
  signedIn,
}: {
  market: LiveMarket;
  spendable: LiveNote[];
  signedIn: boolean;
}) {
  const { pool, config, bet, activity, error, clearError } = useMarket();
  const { connect, connecting } = useWallet();
  const { mode } = useDetailMode();
  const [side, setSide] = useState<Side | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);

  const transition = `background ${motion.control}, border-color ${motion.control}, color ${motion.control}`;
  const label = (t: string) => (
    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 20 }}>{t}</div>
  );

  // --- states where no bet is possible, each said plainly rather than as a dead button ---

  if (market.phase !== "betting") {
    return (
      <div>
        {label(market.phase === "closed" ? "Betting closed" : "Decided")}
        <div style={{ fontFamily: font.display, fontSize: 34, lineHeight: 1.05, color: color.ivory, marginBottom: 20 }}>
          {market.phase === "closed" ? "No new bets." : `Resolved ${market.outcome}.`}
        </div>
        <p style={{ margin: "0 0 28px", fontSize: 16, color: color.pewter }}>
          {market.phase === "closed"
            ? "The window closed. This market is waiting on the resolver, then on settlement. Positions stay sealed until then."
            : market.settled
              ? "Winning positions can be claimed from your portfolio. Claiming pays into a new balance; sending it out is a separate step."
              : "The outcome is recorded. Totals are published in the settlement transaction, and claiming opens after that."}
        </p>
        <Link
          href="/portfolio"
          style={{ display: "block", padding: 18, border: `1px solid ${color.hairlineStrong}`, color: color.bone, borderRadius: 2, textAlign: "center", textDecoration: "none", fontSize: 15 }}
        >
          Go to your portfolio
        </Link>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div>
        {label("Take a position")}
        <div style={{ fontFamily: font.display, fontSize: 34, lineHeight: 1.05, color: color.ivory, marginBottom: 20 }}>
          Connect to trade.
        </div>
        <p style={{ margin: "0 0 28px", fontSize: 16, color: color.pewter }}>
          You will sign a message so we can hand back your balance. It is not a transaction and costs nothing.
        </p>
        <button
          onClick={() => connect()}
          disabled={connecting}
          style={{ width: "100%", padding: 20, border: 0, background: color.ivory, color: color.void, borderRadius: 2, cursor: "pointer", fontFamily: font.display, fontSize: 20, letterSpacing: "0.14em" }}
        >
          {connecting ? "CONNECTING…" : "CONNECT WALLET"}
        </button>
      </div>
    );
  }

  if (pool && !pool.anonymityOk) {
    const shortBy = pool.minAnonymitySet - pool.totalDeposits;
    return (
      <div>
        <div style={{ height: 1, background: color.ember, marginBottom: 28 }} />
        {label("The house declines")}
        <div style={{ fontFamily: font.display, fontSize: 34, lineHeight: 1.05, color: color.ivory, marginBottom: 20 }}>
          The room is too empty.
        </div>
        <p style={{ margin: "0 0 28px", fontSize: 16, color: color.pewter }}>
          Only <span style={{ fontFamily: font.mono, color: color.ivory }}>{pool.totalDeposits}</span> notes exist in
          the pool and the floor is <span style={{ fontFamily: font.mono, color: color.ivory }}>{pool.minAnonymitySet}</span>.
          Your proof would be flawless and you would still be identifiable — there is nobody to be mistaken for.
          {shortBy > 0 && ` ${shortBy} more deposit${shortBy === 1 ? "" : "s"} and the floor is met.`}
        </p>
        <Link
          href="/wallet"
          style={{ display: "block", padding: 18, border: `1px solid ${color.hairlineStrong}`, color: color.bone, borderRadius: 2, textAlign: "center", textDecoration: "none", fontSize: 15 }}
        >
          Add funds — join the pool
        </Link>
      </div>
    );
  }

  if (spendable.length === 0) {
    return (
      <div>
        {label("Take a position")}
        <div style={{ fontFamily: font.display, fontSize: 34, lineHeight: 1.05, color: color.ivory, marginBottom: 20 }}>
          Nothing to stake yet.
        </div>
        <p style={{ margin: "0 0 28px", fontSize: 16, color: color.pewter }}>
          A trade uses one balance in full. Add funds, wait a moment for it to join the pool, then come back.
        </p>
        <Link
          href="/wallet"
          style={{ display: "block", padding: 18, border: 0, background: color.ivory, color: color.void, borderRadius: 2, textAlign: "center", textDecoration: "none", fontFamily: font.display, fontSize: 20, letterSpacing: "0.14em" }}
        >
          ADD FUNDS
        </Link>
        {pool && (
          <p style={{ margin: "16px 0 0", fontSize: 13, color: color.ash }}>
            {pool.queuedCount} note{pool.queuedCount === 1 ? "" : "s"} are queued for the next graft right now.
          </p>
        )}
      </div>
    );
  }

  const selected = spendable.find((n) => n.id === noteId) ?? null;
  const ready = side !== null && selected !== null && !activity;
  const amounts = Array.from(new Set(spendable.map((n) => Number(n.units)))).sort((a, b) => a - b);

  return (
    <div>
      {label("Take a position")}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {(["yes", "no"] as const).map((s) => {
          const on = side === s;
          return (
            <PillButton
              key={s}
              selected={on}
              onClick={() => setSide(s)}
              className="px-4 py-7 text-left"
              selectedClassName={s === "yes" ? "bg-ivory text-void border-ivory" : "bg-ash text-void border-ash"}
              unselectedClassName={s === "yes" ? "bg-transparent text-ivory border-hairlineStrong" : "bg-transparent text-smoke border-hairline"}
            >
              <span className="block font-display text-[22px] tracking-[0.16em]">{s.toUpperCase()}</span>
              <span className="block font-mono text-[13px] mt-1.5 opacity-75">
                {s === "yes" ? market.oddsYesPct : 100 - market.oddsYesPct}%
              </span>
            </PillButton>
          );
        })}
      </div>

      <div style={{ marginTop: 28, marginBottom: 14, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>
        {mode === "detailed" ? "Stake one note" : "Choose an amount"}
      </div>

      {mode === "detailed" ? (
        <div style={{ display: "grid", gap: 8 }}>
          {spendable.map((n) => (
            <PillButton
              key={n.id}
              selected={noteId === n.id}
              onClick={() => setNoteId(n.id)}
              className="justify-between px-4 py-3.5 flex"
            >
              <span className="font-mono text-sm">{n.units} units</span>
              <span className="font-mono text-xs text-ash">0x{n.id}</span>
            </PillButton>
          ))}
        </div>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${amounts.length},1fr)` }}>
          {amounts.map((amount) => {
            const match = spendable.find((n) => Number(n.units) === amount);
            const isSelected = selected !== null && Number(selected.units) === amount;
            return (
              <PillButton
                key={amount}
                selected={isSelected}
                onClick={() => match && setNoteId(match.id)}
                className="py-4"
              >
                {amount}
              </PillButton>
            );
          })}
        </div>
      )}

      {mode !== "detailed" && selected && (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: color.ash, fontFamily: font.mono }}>0x{selected.id}</p>
      )}

      <div style={{ marginTop: 14 }}>
        <Detail summary="Why only the whole amount?">
          <p style={{ margin: 0, fontSize: 13, color: color.ash }}>
            A bet spends the whole note. Amounts are fixed denominations because an unusual amount is a name tag.
          </p>
        </Detail>
      </div>

      <div style={{ marginTop: 14, borderTop: `1px solid ${color.hairline}` }}>
        <StatRow label="Stake">{selected ? `${selected.units} units` : "—"}</StatRow>
        <StatRow label="Gas">none — relayed for you</StatRow>
        <StatRow label="Proof">{config ? `${config.circuits.bet.constraints.toLocaleString()} constraints` : "—"}</StatRow>
      </div>

      {error && (
        <div style={{ marginTop: 16, fontSize: 13, color: color.ember }}>
          {error}{" "}
          <button onClick={clearError} style={{ background: "none", border: 0, color: color.ash, cursor: "pointer", textDecoration: "underline", fontSize: 13 }}>
            dismiss
          </button>
        </div>
      )}

      <button
        onClick={() => selected && side && bet(selected.id, market.marketId, side)}
        disabled={!ready}
        style={{
          position: "relative",
          overflow: "hidden",
          marginTop: 28,
          width: "100%",
          padding: 22,
          border: `1px solid ${ready ? color.ivory : color.hairline}`,
          background: ready ? color.ivory : "transparent",
          color: ready ? color.void : color.ash,
          borderRadius: 2,
          cursor: ready ? "pointer" : "not-allowed",
          fontFamily: font.display,
          fontSize: 22,
          letterSpacing: "0.16em",
          transition,
        }}
      >
        <ShineButton active={ready} />
        SEAL
      </button>
      <p style={{ margin: "14px 0 0", fontSize: 13, color: color.ash }}>
        {side === null ? "Choose a side." : !selected ? "Choose an amount." : "Your stake is encrypted before it leaves. Only the total is ever added up."}
      </p>
    </div>
  );
}
