"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { c, line, fill, font, noteState, type NoteStateKey } from "@/lib/atrum/v2/tokens";
import { settledPayout } from "@/lib/atrum/v2/odds";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import { useDetailMode } from "@/lib/atrum/detailMode";
import type { LiveNote, LiveMarket } from "@/lib/atrum/api";
import ClaimDialog from "@/components/v2/ClaimDialog";
import WithdrawDialog from "@/components/v2/WithdrawDialog";

/**
 * Your notes.
 *
 * LOCKED IS NOT EMPTY, and conflating the two is the bug that made v1's portfolio tell people
 * with live positions that they had nothing. Notes are sealed with a key only the wallet can
 * derive; until it is derived this screen knows the count is unknown, not zero.
 *
 * Everything shown is derived from the note plus its market, never invented. A won note states
 * what redeeming will actually pay, computed with the same arithmetic the circuit constrains,
 * because "WON · 10" next to a note worth 32 is how a 3.2x win reads as a break-even.
 */

interface Derived {
  key: NoteStateKey;
  headline: string;
  sub: string;
  /** What redeeming pays, when that is knowable and different from the stake. */
  payout: number | null;
  market?: LiveMarket;
}

function derive(note: LiveNote, markets: LiveMarket[]): Derived {
  const market = markets.find((m) => String(m.marketId) === note.marketId);
  const units = Number(note.units);

  if (note.status === "spent") {
    return { key: "spent", headline: String(units), sub: "Already used. Its nullifier is on chain.", payout: null, market };
  }
  if (note.status === "queued") {
    return {
      key: "pending",
      headline: String(units),
      sub: note.txHash
        ? "On chain, joining the next batch. That wait is what makes it indistinguishable."
        : "Building — not yet broadcast.",
      payout: null,
      market,
    };
  }
  // outcome 3 is a settled payout note: collateral that has already been won and can leave.
  if (note.outcome === 3 || note.outcome === 0) {
    return {
      key: "ready",
      headline: String(units),
      sub: "Unallocated. Spend it on a bet or withdraw it — either move seals a new note.",
      payout: null,
      market,
    };
  }

  const side = note.outcome === 1 ? "YES" : "NO";
  if (!market?.settled) {
    return {
      key: "position",
      headline: String(units),
      sub: `${side} on "${market?.question ?? `market #${note.marketId}`}". Nothing about it is public until settlement.`,
      payout: null,
      market,
    };
  }

  const won = market.outcome === side;
  if (!won) {
    return { key: "lost", headline: String(units), sub: "This market went the other way.", payout: null, market };
  }
  return {
    key: "won",
    headline: String(units),
    sub: `${side} on "${market.question}" — staked ${units}.`,
    payout: settledPayout(market, units),
    market,
  };
}

export default function V2PortfolioPage() {
  const { notes, markets, clientProving, vaultUnlocked, vaultUnlocking, unlockVault, error } = useMarket();
  const { session, connect } = useWallet();
  const { mode } = useDetailMode();
  const detail = mode === "detailed";

  const [claimId, setClaimId] = useState<string | null>(null);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);

  const rows = useMemo(
    () => notes.filter((n) => n.status !== "spent").map((n) => ({ note: n, d: derive(n, markets) })),
    [notes, markets],
  );

  const claimRow = rows.find((r) => r.note.id === claimId);
  const withdrawRow = rows.find((r) => r.note.id === withdrawId);

  if (!session) {
    return (
      <Centered
        title="Connect to see your notes"
        body="Your notes are sealed objects held against your address. Nothing loads until a wallet proves it."
        action={<button onClick={connect} style={primaryBtn}>CONNECT WALLET</button>}
      />
    );
  }

  if (clientProving && !vaultUnlocked) {
    return (
      <Centered
        icon
        title="Your notes are sealed"
        body="Encrypted with a key only your wallet can derive. This site cannot read them — one signature opens the safe."
        action={
          <button onClick={unlockVault} disabled={vaultUnlocking} style={{ ...primaryBtn, cursor: vaultUnlocking ? "wait" : "pointer" }}>
            {vaultUnlocking ? "CHECK YOUR WALLET…" : "SIGN TO OPEN"}
          </button>
        }
        footnote="personal_sign · derives the key locally, never sent"
        error={error}
      />
    );
  }

  return (
    <main style={{ maxWidth: 880, width: "100%", margin: "0 auto", padding: "36px 24px 80px", animation: "v2FadeIn .3s ease" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Your notes</h1>
        <div style={{ fontFamily: font.mono, fontSize: 11, color: c.faint }}>
          {rows.length} SEALED {rows.length === 1 ? "OBJECT" : "OBJECTS"} · VISIBLE ONLY TO YOU
        </div>
      </div>
      <p style={{ color: c.dim, fontSize: 13.5, margin: "0 0 28px" }}>
        Notes are spent and reminted, never edited. Each state permits different moves.
      </p>

      {error && (
        <div style={{ border: `1px solid rgba(208,112,95,0.4)`, borderRadius: 8, padding: "12px 16px", marginBottom: 20, color: c.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ padding: 64, border: `1px solid ${line.soft}`, borderRadius: 10, textAlign: "center" }}>
          <p style={{ margin: "0 0 20px", fontSize: 15, color: c.dim }}>Nothing sealed yet.</p>
          <Link href="/v2/transfer" style={{ color: c.gold, fontSize: 14 }}>
            Cross the threshold →
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
          {rows.map(({ note, d }, i) => {
            const meta = noteState[d.key];
            return (
              <div
                key={note.id}
                style={{
                  border: `1px solid ${meta.border}`,
                  background: c.panel,
                  borderRadius: 12,
                  padding: 20,
                  animation: "v2FadeUp .4s ease both",
                  animationDelay: `${i * 0.07}s`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span
                    style={{
                      fontFamily: font.mono,
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      padding: "3px 8px",
                      borderRadius: 4,
                      color: meta.color,
                      background: meta.bg,
                    }}
                  >
                    {meta.label}
                  </span>
                  <span style={{ fontFamily: font.mono, fontSize: 10, color: c.faint }}>0x{note.id}</span>
                </div>

                {/*
                  A won note shows what redeeming PAYS, with the stake struck through. Showing
                  only the stake is how a 3.2x win reads as a break-even -- someone hit exactly
                  that on market 55.
                */}
                <div style={{ fontFamily: font.mono, fontSize: 26, fontWeight: 500, marginBottom: 4, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  {d.payout !== null && d.payout !== Number(note.units) ? (
                    <>
                      <span style={{ color: c.faint, textDecoration: "line-through", fontSize: 18 }}>{d.headline}</span>
                      <span style={{ color: c.green }}>{d.payout}</span>
                      <span style={{ fontSize: 11, color: c.faint }}>
                        {(d.payout / Number(note.units)).toFixed(2)}×
                      </span>
                    </>
                  ) : (
                    <span>{d.headline}</span>
                  )}
                </div>

                <div style={{ fontSize: 12.5, color: c.dim, minHeight: 32, lineHeight: 1.45, marginBottom: 12 }}>{d.sub}</div>

                {d.key === "won" && (
                  <button onClick={() => setClaimId(note.id)} style={claimBtn}>
                    CLAIM → NEW SEALED NOTE
                  </button>
                )}
                {d.key === "ready" && (
                  <button onClick={() => setWithdrawId(note.id)} style={withdrawBtn}>
                    WITHDRAW
                  </button>
                )}

                {detail && (
                  <div
                    style={{
                      marginTop: 12,
                      borderTop: `1px solid ${line.faint}`,
                      paddingTop: 10,
                      fontFamily: font.mono,
                      fontSize: 10,
                      color: c.faint,
                      lineHeight: 1.7,
                      wordBreak: "break-all",
                    }}
                  >
                    commitment {note.commitment.slice(0, 14)}…
                    <br />
                    outcome {note.outcome} · {note.status}
                    {note.marketId !== "0" && ` · market #${note.marketId}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {claimRow && claimRow.d.payout !== null && (
        <ClaimDialog
          noteId={claimRow.note.id}
          stake={Number(claimRow.note.units)}
          payout={claimRow.d.payout}
          onClose={() => setClaimId(null)}
        />
      )}
      {withdrawRow && (
        <WithdrawDialog noteId={withdrawRow.note.id} amount={Number(withdrawRow.note.units)} onClose={() => setWithdrawId(null)} />
      )}
    </main>
  );
}

function Centered({
  title,
  body,
  action,
  footnote,
  icon,
  error,
}: {
  title: string;
  body: string;
  action: React.ReactNode;
  footnote?: string;
  icon?: boolean;
  error?: string | null;
}) {
  return (
    <main style={{ maxWidth: 880, width: "100%", margin: "0 auto", padding: "36px 24px 80px" }}>
      <div style={{ maxWidth: 440, margin: "64px auto 0", textAlign: "center" }}>
        {icon && (
          <div
            style={{
              width: 88,
              height: 88,
              margin: "0 auto 28px",
              border: `1px solid ${line.gold}`,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                border: `1.5px solid ${c.gold}`,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "v2Breathe 3s ease-in-out infinite",
              }}
            >
              <div style={{ width: 10, height: 10, background: c.gold, transform: "rotate(45deg)" }} />
            </div>
          </div>
        )}
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 10px" }}>{title}</h1>
        <p style={{ color: c.dim, fontSize: 14, lineHeight: 1.6, margin: "0 0 28px", textWrap: "pretty" }}>{body}</p>
        {action}
        {footnote && <div style={{ marginTop: 14, fontFamily: font.mono, fontSize: 11, color: c.faint }}>{footnote}</div>}
        {error && <div style={{ marginTop: 16, fontSize: 12.5, color: c.red, lineHeight: 1.5 }}>{error}</div>}
      </div>
    </main>
  );
}

const primaryBtn: React.CSSProperties = {
  background: fill.gold,
  border: `1px solid ${line.goldStrong}`,
  color: c.text,
  fontFamily: font.mono,
  fontSize: 13,
  letterSpacing: "0.08em",
  padding: "14px 32px",
  borderRadius: 8,
  cursor: "pointer",
};

const claimBtn: React.CSSProperties = {
  width: "100%",
  background: fill.green,
  border: `1px solid ${line.green}`,
  color: c.green,
  fontFamily: font.mono,
  fontSize: 12,
  letterSpacing: "0.08em",
  padding: "11px 0",
  borderRadius: 7,
  cursor: "pointer",
};

const withdrawBtn: React.CSSProperties = {
  width: "100%",
  background: "none",
  border: `1px solid ${line.strong}`,
  color: c.bright,
  fontFamily: font.mono,
  fontSize: 12,
  letterSpacing: "0.08em",
  padding: "11px 0",
  borderRadius: 7,
  cursor: "pointer",
};
