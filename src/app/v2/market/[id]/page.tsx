"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { c, line, fill, font, DENOMINATIONS } from "@/lib/atrum/v2/tokens";
import { impliedYesPct, centsFor, closesIn, project } from "@/lib/atrum/v2/odds";
import { useSounds } from "@/lib/atrum/v2/feel";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import { useDetailMode } from "@/lib/atrum/detailMode";

/**
 * A market, and the ticket that seals a position in it.
 *
 * HOLD TO COMMIT, NOT CLICK. A bet here is irreversible, relayed, and cannot be cancelled once
 * the proof is submitted -- so the interaction asks for a second of deliberate pressure rather
 * than a click that can be misfired. The ring filling is the commitment being made; the thunk
 * at the end is the vault door landing.
 *
 * Every number is live. The projection is explicitly conditional, because in a parimutuel
 * market the payout genuinely is -- see odds.ts.
 */

const HOLD_MS = 800;

export default function V2MarketPage() {
  const params = useParams<{ id: string }>();
  const marketId = Number(params.id);
  const { markets, config, notes, clientProving, vaultUnlocked, unlockVault, bet, activity, error } = useMarket();
  const { session, connect } = useWallet();
  const { mode } = useDetailMode();
  const detail = mode === "detailed";
  const { thunk } = useSounds();

  const market = markets.find((m) => m.marketId === marketId);

  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [stake, setStake] = useState(100);
  const [hold, setHold] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fired = useRef(false);

  /** A grafted, unbet note big enough to cover the stake. Without one, we must deposit first. */
  const readyNote = notes.find((n) => n.status === "grafted" && n.outcome === 0 && Number(n.units) === stake);

  const commit = useCallback(() => {
    if (!market || fired.current) return;
    fired.current = true;
    thunk();
    // The note is chosen by exact denomination, so a bet always spends one whole note --
    // there is no partial spend in the protocol.
    if (readyNote) void bet(readyNote.id, market.marketId, side === "YES" ? "yes" : "no");
  }, [market, readyNote, side, bet, thunk]);

  const startHold = useCallback(() => {
    if (!market || activity || stake <= 0) return;
    fired.current = false;
    if (holdTimer.current) clearInterval(holdTimer.current);
    const started = performance.now();
    holdTimer.current = setInterval(() => {
      const pct = Math.min(100, ((performance.now() - started) / HOLD_MS) * 100);
      setHold(pct);
      if (pct >= 100) {
        if (holdTimer.current) clearInterval(holdTimer.current);
        commit();
      }
    }, 16);
  }, [market, activity, stake, commit]);

  const endHold = useCallback(() => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    if (!fired.current) setHold(0);
  }, []);

  useEffect(() => () => void (holdTimer.current && clearInterval(holdTimer.current)), []);
  // Reset the ring once an action finishes, so a second bet starts from empty. Deferred by a
  // tick: a synchronous state update in an effect body forces an extra render before paint.
  useEffect(() => {
    if (activity) return;
    fired.current = false;
    const id = setTimeout(() => setHold(0), 0);
    return () => clearTimeout(id);
  }, [activity]);

  if (!market) {
    return (
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "60px 24px", color: c.dim }}>
        {markets.length === 0 ? "Loading…" : `No market #${marketId} on this pool.`}
      </main>
    );
  }

  const yesPct = impliedYesPct(market);
  const proj = project(market, side, stake);
  const closed = market.phase !== "betting";
  const sideColor = side === "YES" ? c.green : c.red;

  return (
    <main style={{ maxWidth: 880, width: "100%", margin: "0 auto", padding: "32px 24px 80px", animation: "v2FadeIn .3s ease" }}>
      <Link href="/v2" style={{ color: c.dim, fontFamily: font.mono, fontSize: 12, textDecoration: "none", display: "inline-block", marginBottom: 24 }}>
        ← MARKETS
      </Link>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
        {/* ---------------------------------------------------------- left */}
        <div style={{ flex: 1.2, minWidth: 300 }}>
          <div style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: "0.12em", color: c.faint, marginBottom: 10 }}>
            {market.category.toUpperCase()} · {closed ? market.phase.toUpperCase() : `CLOSES ${closesIn(market.bettingCloseTime).toUpperCase()}`}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 28px", letterSpacing: "-0.015em", lineHeight: 1.25, textWrap: "pretty" }}>
            {market.question}
          </h1>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: font.mono, fontSize: 11, color: c.green, letterSpacing: "0.1em", marginBottom: 4 }}>YES</div>
              <div style={{ fontFamily: font.mono, fontSize: 42, fontWeight: 500, color: c.green, lineHeight: 1 }}>{centsFor(yesPct)}</div>
            </div>
            <div style={{ flex: 1, height: 44, position: "relative", borderRadius: 6, overflow: "hidden", background: "rgba(208,112,95,0.16)" }}>
              <div
                style={{
                  position: "absolute",
                  inset: "0 auto 0 0",
                  width: `${yesPct}%`,
                  background: "linear-gradient(90deg,rgba(61,190,139,.25),rgba(61,190,139,.5))",
                  borderRight: "2px solid rgba(231,233,236,.7)",
                  transition: "width 1.1s cubic-bezier(.4,0,.2,1)",
                }}
              />
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, color: c.red, letterSpacing: "0.1em", marginBottom: 4 }}>NO</div>
              <div style={{ fontFamily: font.mono, fontSize: 42, fontWeight: 500, color: c.red, lineHeight: 1 }}>{centsFor(100 - yesPct)}</div>
            </div>
          </div>

          <p style={{ color: c.dim, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Winners divide the pool. Your side, your size and your identity stay sealed — the odds you move are the only
            trace you leave.
          </p>

          {detail && (
            <div
              style={{
                marginTop: 20,
                border: `1px solid ${line.soft}`,
                borderRadius: 8,
                padding: "14px 16px",
                fontFamily: font.mono,
                fontSize: 11,
                color: c.dim,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <Row label="market id" value={`#${market.marketId}`} />
              <Row label="vault" value={`${market.vault.slice(0, 8)}…${market.vault.slice(-4)}`} />
              <Row label="pool" value={`${market.yesUnits} yes · ${market.noUnits} no`} />
              {config && <Row label="bet circuit" value={`${config.circuits.bet.constraints.toLocaleString("en-US")} constraints`} />}
              <Row label="settled" value={market.settled ? "yes" : "no"} />
            </div>
          )}
        </div>

        {/* --------------------------------------------------------- ticket */}
        <div style={{ flex: 1, minWidth: 300, border: `1px solid ${line.base}`, background: c.panel, borderRadius: 12, padding: 24 }}>
          <div style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: "0.14em", color: c.faint, marginBottom: 16 }}>
            SEALED TICKET
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <SideButton label={`YES ${centsFor(yesPct)}`} active={side === "YES"} tone={c.green} onClick={() => setSide("YES")} />
            <SideButton label={`NO ${centsFor(100 - yesPct)}`} active={side === "NO"} tone={c.red} onClick={() => setSide("NO")} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: c.dim, marginBottom: 6 }}>Stake</div>
            <div style={{ display: "flex", alignItems: "center", border: `1px solid ${line.strong}`, borderRadius: 8, background: c.well, padding: "0 14px" }}>
              <div style={{ flex: 1, fontFamily: font.mono, fontSize: 20, padding: "12px 0", color: c.text }}>{stake}</div>
              <span style={{ fontFamily: font.mono, fontSize: 12, color: c.faint }}>{config?.token.symbol ?? "units"}</span>
            </div>
            {/*
              Denominations only. Every note is one rung of the ladder, and a bet spends a whole
              note -- so a free-text field would only ever produce amounts the contract rejects.
            */}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {DENOMINATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setStake(d)}
                  style={{
                    background: stake === d ? fill.gold : "none",
                    border: `1px solid ${stake === d ? line.gold : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 6,
                    color: stake === d ? c.text : c.dim,
                    fontFamily: font.mono,
                    fontSize: 12,
                    padding: "5px 12px",
                    cursor: "pointer",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${line.soft}`, padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 12.5, color: c.dim }}>If {side} wins</span>
            <span style={{ fontFamily: font.mono, fontSize: 22, color: c.text, fontWeight: 500 }}>
              {proj.payout} <span style={{ fontSize: 12, color: c.faint }}>{config?.token.symbol ?? ""}</span>
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: c.faint }}>{proj.multiple.toFixed(2)}× if the pool holds</span>
            <span style={{ fontFamily: font.mono, fontSize: 12, color: sideColor }}>+{proj.profit}</span>
          </div>
          {/*
            Said plainly rather than dressed up. A parimutuel payout is not knowable at bet time,
            and an unopposed side pays your own stake back -- both facts a trader needs before
            committing, not after.
          */}
          <div style={{ fontSize: 11.5, color: c.faint, marginBottom: 18, lineHeight: 1.5 }}>
            {proj.unopposed
              ? "Nobody has taken the other side yet. As it stands this pays your stake back — the return only appears once someone disagrees."
              : "Both pools keep moving until close, so this is what the pool pays right now, not a guarantee."}
          </div>

          {closed ? (
            <Notice>Betting has closed on this market.</Notice>
          ) : !session ? (
            <button onClick={connect} style={primaryBtn}>CONNECT WALLET</button>
          ) : clientProving && !vaultUnlocked ? (
            <>
              <button onClick={unlockVault} style={primaryBtn}>UNLOCK YOUR NOTES</button>
              <div style={{ textAlign: "center", marginTop: 10, fontSize: 11.5, color: c.faint }}>
                One signature. It derives the key to your notes and never leaves your browser.
              </div>
            </>
          ) : !readyNote ? (
            <>
              <Link href="/v2/transfer" style={{ ...primaryBtn, display: "block", textAlign: "center", textDecoration: "none" }}>
                DEPOSIT {stake} FIRST
              </Link>
              <div style={{ textAlign: "center", marginTop: 10, fontSize: 11.5, color: c.faint }}>
                You need a sealed note of exactly {stake} to bet {stake}. Deposits join a batch before they can be spent.
              </div>
            </>
          ) : (
            <>
              <div
                onMouseDown={startHold}
                onMouseUp={endHold}
                onMouseLeave={endHold}
                onTouchStart={startHold}
                onTouchEnd={endHold}
                role="button"
                tabIndex={0}
                style={{
                  position: "relative",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  cursor: "pointer",
                  borderRadius: 10,
                  background: hold >= 100 ? fill.goldLit : "rgba(200,164,101,0.07)",
                  border: `1px solid ${line.gold}`,
                  padding: "16px 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  transform: `scale(${1 - hold * 0.0006})`,
                  transition: "transform .12s ease, background .2s",
                }}
              >
                <svg width="26" height="26" viewBox="0 0 26 26" style={{ flexShrink: 0 }}>
                  <circle cx="13" cy="13" r="10.5" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
                  <circle
                    cx="13"
                    cy="13"
                    r="10.5"
                    fill="none"
                    stroke={c.gold}
                    strokeWidth="2"
                    strokeDasharray="66"
                    strokeDashoffset={66 * (1 - hold / 100)}
                    strokeLinecap="round"
                    transform="rotate(-90 13 13)"
                  />
                </svg>
                <span style={{ fontFamily: font.mono, fontSize: 13, letterSpacing: "0.1em", color: c.text, fontWeight: 500 }}>
                  {hold >= 100 ? "COMMITTED" : `HOLD TO COMMIT — ${side} · ${stake}`}
                </span>
              </div>
              <div style={{ textAlign: "center", marginTop: 10, fontSize: 11.5, color: c.faint }}>
                Hold to commit. Your address will not appear on this transaction.
              </div>
            </>
          )}

          {error && <Notice tone={c.red}>{error}</Notice>}
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>{label}</span>
      <span style={{ color: c.bright }}>{value}</span>
    </div>
  );
}

function SideButton({ label, active, tone, onClick }: { label: string; active: boolean; tone: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "14px 0",
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: font.mono,
        fontSize: 14,
        fontWeight: 500,
        background: active ? (tone === c.green ? fill.green : fill.red) : "none",
        border: `1px solid ${active ? tone : "rgba(255,255,255,0.1)"}`,
        color: active ? tone : c.faint,
        transition: "all .15s",
      }}
    >
      {label}
    </button>
  );
}

function Notice({ children, tone = c.dim }: { children: React.ReactNode; tone?: string }) {
  return (
    <div style={{ marginTop: 14, fontSize: 12.5, color: tone, textAlign: "center", lineHeight: 1.5 }}>{children}</div>
  );
}

const primaryBtn: React.CSSProperties = {
  width: "100%",
  background: fill.gold,
  border: `1px solid ${line.goldStrong}`,
  color: c.text,
  fontFamily: font.mono,
  fontSize: 13,
  letterSpacing: "0.1em",
  padding: "15px 0",
  borderRadius: 8,
  cursor: "pointer",
};
