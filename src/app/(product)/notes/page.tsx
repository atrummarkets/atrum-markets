"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { color, font } from "@/lib/atrum/theme";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import { txUrl, shortHash } from "@/lib/atrum/format";
import type { LiveNote } from "@/lib/atrum/api";
import WithdrawDialog from "@/components/atrum/WithdrawDialog";

const COLUMNS = "150px 1fr 130px 150px 180px";

/** Every state a note can be in, derived from real fields -- never invented. */
function describe(note: LiveNote, settledMarkets: Set<string>, winners: Set<string>) {
  if (note.status === "spent") {
    return { state: "SPENT", detail: "Already used. Its nullifier is on chain.", action: null, tone: color.smoke };
  }
  if (note.status === "queued") {
    return {
      state: "QUEUED",
      detail: note.txHash ? "On chain, waiting for the next batch graft." : "Building — not yet broadcast.",
      action: null,
      tone: color.ash,
    };
  }
  // grafted
  if (note.outcome === 0) {
    return {
      state: "COLLATERAL",
      detail: "In the tree. Can back a bet in any market, or exit.",
      action: "bet" as const,
      tone: color.pewter,
    };
  }
  if (note.outcome === 3) {
    return {
      state: "SETTLED",
      detail: "A payout note. Withdraw whenever you like — later is quieter.",
      action: "withdraw" as const,
      tone: color.halo,
    };
  }
  const side = note.outcome === 1 ? "YES" : "NO";
  if (!settledMarkets.has(note.marketId)) {
    return {
      state: `${side} · OPEN`,
      detail: `Sealed in market #${note.marketId}. Nothing about it is public until settlement.`,
      action: null,
      tone: color.ivory,
    };
  }
  if (winners.has(`${note.marketId}:${note.outcome}`)) {
    return {
      state: `${side} · WON`,
      detail: "Redeeming pays into a shielded note. No collateral moves.",
      action: "redeem" as const,
      tone: color.halo,
    };
  }
  return { state: `${side} · LOST`, detail: `Market #${note.marketId} resolved the other way.`, action: null, tone: color.smoke };
}

export default function NotesPage() {
  const router = useRouter();
  const { notes, markets, activity, error, clearError, redeem } = useMarket();
  const { session, connect, connecting } = useWallet();
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
          Your notes
        </h1>
        <p style={{ margin: "0 0 32px", fontSize: 19, color: color.smoke }}>
          Connect your wallet to see them. You will sign a message to prove the address is yours — no transaction,
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
    <main style={{ padding: "80px 64px 128px", maxWidth: 1300 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 32, flexWrap: "wrap", marginBottom: 16 }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 400, fontSize: "clamp(30px,3.6vw,46px)", color: color.ivory, margin: 0 }}>
          Your notes
        </h1>
        <Link
          href="/boundary"
          style={{ padding: "14px 28px", border: 0, background: color.ivory, color: color.void, borderRadius: 2, textDecoration: "none", fontSize: 15 }}
        >
          Deposit
        </Link>
      </div>
      <p style={{ margin: "0 0 48px", fontSize: 19, color: color.smoke, maxWidth: "62ch" }}>
        There is no account and no balance. You hold notes — sealed objects with states. Each state permits
        different things.
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
            No notes yet. Deposit collateral to get your first one.
          </p>
          <Link href="/boundary" style={{ color: color.halo, fontSize: 15 }}>
            Go to the boundary →
          </Link>
        </div>
      ) : (
        <div style={{ border: `1px solid ${color.hairline}` }}>
          <div
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
            <span>Note</span>
            <span>State</span>
            <span>Units</span>
            <span>Transaction</span>
            <span>Permits</span>
          </div>

          {notes.map((n) => {
            const d = describe(n, settledMarkets, winners);
            const busy = activity?.noteId === n.id;
            return (
              <div
                key={n.id}
                style={{ display: "grid", gridTemplateColumns: COLUMNS, gap: 24, padding: "24px 28px", borderBottom: `1px solid ${color.hairline}`, alignItems: "center" }}
              >
                <span style={{ fontFamily: font.mono, fontSize: 14, color: color.pewter }}>0x{n.id}</span>
                <div>
                  <div style={{ fontFamily: font.display, fontSize: 21, letterSpacing: "0.14em", color: d.tone }}>{d.state}</div>
                  <div style={{ fontSize: 13, color: color.ash, marginTop: 4 }}>{d.detail}</div>
                </div>
                <span style={{ fontFamily: font.mono, fontSize: 14, color: color.bone }}>{n.units}</span>
                <span style={{ fontFamily: font.mono, fontSize: 12 }}>
                  {n.txHash ? (
                    <a href={txUrl(n.txHash)} target="_blank" rel="noreferrer" style={{ color: color.ash, textDecoration: "none" }}>
                      {shortHash(n.txHash)} ↗
                    </a>
                  ) : (
                    <span style={{ color: color.iron }}>—</span>
                  )}
                </span>
                <div>
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
                      {busy ? "Working…" : d.action}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ margin: "28px 0 0", fontSize: 15, color: color.ash, maxWidth: "76ch" }}>
        Redeem and withdraw are two steps and stay two steps. A parimutuel payout is an odd number set by your
        stake; paying it straight out would publish a figure that names your position exactly.
      </p>

      {withdrawing && <WithdrawDialog note={withdrawing} onClose={() => setWithdrawing(null)} />}
    </main>
  );
}
