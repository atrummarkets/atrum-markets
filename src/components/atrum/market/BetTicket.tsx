"use client";

import { useState } from "react";
import Link from "next/link";
import { color, font, motion } from "@/lib/atrum/theme";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import type { LiveMarket, LiveNote } from "@/lib/atrum/api";

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
              ? "Winning positions can be redeemed from your notes. Redeeming pays into a shielded note; withdrawing is a separate step."
              : "The outcome is recorded. Totals are published in the settlement transaction, and redemption opens after that."}
        </p>
        <Link
          href="/notes"
          style={{ display: "block", padding: 18, border: `1px solid ${color.hairlineStrong}`, color: color.bone, borderRadius: 2, textAlign: "center", textDecoration: "none", fontSize: 15 }}
        >
          Go to your notes
        </Link>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div>
        {label("Take a position")}
        <div style={{ fontFamily: font.display, fontSize: 34, lineHeight: 1.05, color: color.ivory, marginBottom: 20 }}>
          Connect to bet.
        </div>
        <p style={{ margin: "0 0 28px", fontSize: 16, color: color.pewter }}>
          You will sign a message so we can hand back your notes. It is not a transaction and costs nothing.
        </p>
        <button
          onClick={connect}
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
          href="/boundary"
          style={{ display: "block", padding: 18, border: `1px solid ${color.hairlineStrong}`, color: color.bone, borderRadius: 2, textAlign: "center", textDecoration: "none", fontSize: 15 }}
        >
          Deposit — join the pool
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
          A bet spends one unbet note in full. Deposit collateral, wait for it to be grafted into the tree with the
          next batch, then come back.
        </p>
        <Link
          href="/boundary"
          style={{ display: "block", padding: 18, border: 0, background: color.ivory, color: color.void, borderRadius: 2, textAlign: "center", textDecoration: "none", fontFamily: font.display, fontSize: 20, letterSpacing: "0.14em" }}
        >
          DEPOSIT
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

  return (
    <div>
      {label("Take a position")}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {(["yes", "no"] as const).map((s) => {
          const on = side === s;
          const accent = s === "yes" ? color.ivory : color.ash;
          return (
            <button
              key={s}
              onClick={() => setSide(s)}
              style={{
                padding: "28px 16px",
                border: `1px solid ${on ? accent : s === "yes" ? color.hairlineStrong : color.hairline}`,
                background: on ? accent : "transparent",
                color: on ? color.void : s === "yes" ? color.ivory : color.smoke,
                borderRadius: 2,
                cursor: "pointer",
                fontFamily: font.display,
                fontSize: 22,
                letterSpacing: "0.16em",
                textAlign: "left",
                transition,
              }}
            >
              {s.toUpperCase()}
              <div style={{ fontFamily: font.mono, fontSize: 13, letterSpacing: 0, marginTop: 6, opacity: 0.75 }}>
                {s === "yes" ? market.oddsYesPct : 100 - market.oddsYesPct}%
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 28, marginBottom: 14, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>
        Stake one note
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {spendable.map((n) => {
          const on = noteId === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setNoteId(n.id)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                border: `1px solid ${on ? color.ivory : color.hairline}`,
                background: on ? "rgba(245,241,232,0.06)" : "transparent",
                color: on ? color.ivory : color.pewter,
                borderRadius: 2,
                cursor: "pointer",
                transition,
              }}
            >
              <span style={{ fontFamily: font.mono, fontSize: 14 }}>{n.units} units</span>
              <span style={{ fontFamily: font.mono, fontSize: 12, color: color.ash }}>0x{n.id}</span>
            </button>
          );
        })}
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 13, color: color.ash }}>
        A bet spends the whole note. Amounts are fixed denominations because an unusual amount is a name tag.
      </p>

      <div style={{ marginTop: 28, borderTop: `1px solid ${color.hairline}` }}>
        {[
          ["Stake", selected ? `${selected.units} units` : "—"],
          ["Gas", "none — relayed for you"],
          [
            "Proof",
            config ? `${config.circuits.bet.constraints.toLocaleString()} constraints` : "—",
          ],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${color.hairline}` }}>
            <span style={{ fontSize: 15, color: color.smoke }}>{k}</span>
            <span style={{ fontFamily: font.mono, fontSize: 14, color: color.bone }}>{v}</span>
          </div>
        ))}
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
        SEAL
      </button>
      <p style={{ margin: "14px 0 0", fontSize: 13, color: color.ash }}>
        {side === null ? "Choose a side." : !selected ? "Choose which note to stake." : "Your stake is encrypted before it leaves. Only the total is ever added up."}
      </p>
    </div>
  );
}
