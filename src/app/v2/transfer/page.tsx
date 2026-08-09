"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { c, line, fill, font, DENOMINATIONS } from "@/lib/atrum/v2/tokens";
import { useSounds } from "@/lib/atrum/v2/feel";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import { useFlow } from "@/lib/atrum/v2/useFlow";
import FlowOverlay from "@/components/v2/FlowOverlay";

/**
 * The two thresholds.
 *
 * Deposits and withdrawals are the only public moments in the protocol, and the screen says so
 * rather than burying it. Framing them as doors is not decoration: the deposit genuinely is the
 * last point at which the user is visible, because the pool pulls collateral with
 * `transferFrom(msg.sender)` and relaying that would only move the payment one hop.
 */

export default function V2TransferPage() {
  const { config, walletUnits, faucet, deposit, activity, error, clientProving, vaultUnlocked, unlockVault } = useMarket();
  const { session, connect } = useWallet();
  const { thunk } = useSounds();
  const flow = useFlow();
  const router = useRouter();
  const [amount, setAmount] = useState(100);

  const symbol = config?.token.symbol ?? "units";
  const short = walletUnits !== null && walletUnits < amount;

  const go = () => {
    thunk();
    // Opened before the call: the deposit proof downloads its circuit first, and that wait has
    // no wallet prompt attached to explain itself.
    flow.begin("deposit", `${amount} ${symbol}`);
    void deposit(amount);
  };

  return (
    <main style={{ maxWidth: 880, width: "100%", margin: "0 auto", padding: "36px 24px 80px", animation: "v2FadeIn .3s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 6px" }}>The two thresholds</h1>
      <p style={{ color: c.dim, fontSize: 13.5, margin: "0 0 28px", maxWidth: 560, textWrap: "pretty" }}>
        Money enters and exits Atrum in public. Everything between the two doors is sealed.
      </p>

      {error && (
        <div style={{ border: "1px solid rgba(208,112,95,0.4)", borderRadius: 8, padding: "12px 16px", marginBottom: 20, color: c.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* ------------------------------------------------------- door in */}
        <div style={card}>
          <div style={eyebrow}>DOOR IN</div>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 8px" }}>Deposit — visible, permanently</h2>
          <p style={{ fontSize: 13, color: c.dim, lineHeight: 1.6, margin: "0 0 20px" }}>
            Collateral leaves your address on chain and anyone can see it. That is by design — the pool pulls it from
            you, so whoever pays is public. It is the last moment you are visible.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {DENOMINATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setAmount(d)}
                style={{
                  flex: 1,
                  minWidth: 60,
                  border: `1px solid ${amount === d ? "rgba(200,164,101,0.55)" : line.base}`,
                  background: amount === d ? fill.gold : "none",
                  borderRadius: 7,
                  padding: "12px 0",
                  textAlign: "center",
                  fontFamily: font.mono,
                  fontSize: 14,
                  color: amount === d ? c.text : c.bright,
                  cursor: "pointer",
                }}
              >
                {d}
              </button>
            ))}
          </div>

          {/*
            Denominations only, and stated as privacy rather than as a restriction. A deposit off
            the ladder would be rejected by the contract, and a free-text field would invite it.
          */}
          <div style={{ fontSize: 11.5, color: c.faint, marginBottom: 18, lineHeight: 1.5 }}>
            Fixed sizes only. Deposits that look alike are what make notes interchangeable once they are in the pool.
          </div>

          {walletUnits !== null && (
            <div style={{ fontFamily: font.mono, fontSize: 11.5, color: short ? c.red : c.faint, marginBottom: 14 }}>
              WALLET HOLDS {walletUnits} {symbol}
              {short && " — NOT ENOUGH"}
            </div>
          )}

          {!session ? (
            <button onClick={connect} style={primaryBtn}>CONNECT WALLET</button>
          ) : clientProving && !vaultUnlocked ? (
            <button onClick={unlockVault} style={primaryBtn}>UNLOCK YOUR NOTES FIRST</button>
          ) : short ? (
            <button onClick={() => void faucet(amount)} disabled={!!activity} style={{ ...primaryBtn, opacity: activity ? 0.5 : 1 }}>
              {activity ? "WORKING…" : `MINT ${amount} TEST ${symbol}`}
            </button>
          ) : (
            <button onClick={go} disabled={!!activity} style={{ ...primaryBtn, opacity: activity ? 0.5 : 1, cursor: activity ? "wait" : "pointer" }}>
              {activity ? "CROSSING…" : "CROSS THE THRESHOLD"}
            </button>
          )}

          <div style={{ marginTop: 12, fontSize: 11.5, color: c.faint, lineHeight: 1.5 }}>
            After this, your note waits for a batch before it can be spent — usually a minute or two. That wait is the
            privacy being made.
          </div>
        </div>

        {/* ------------------------------------------------------ door out */}
        <div style={card}>
          <div style={eyebrow}>DOOR OUT</div>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 8px" }}>Withdraw — in round chunks</h2>
          <p style={{ fontSize: 13, color: c.dim, lineHeight: 1.6, margin: "0 0 16px" }}>
            Exits happen only in denominations of 1, 10, 100, 1000. A withdrawal of 327 fingerprints you; three 100s
            look like everyone else&apos;s. Change stays sealed.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {DENOMINATIONS.map((d) => (
              <div
                key={d}
                style={{
                  flex: 1,
                  border: `1px solid ${line.base}`,
                  borderRadius: 7,
                  padding: "10px 0",
                  textAlign: "center",
                  fontFamily: font.mono,
                  fontSize: 14,
                  color: c.bright,
                }}
              >
                {d}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11.5, color: c.faint, marginBottom: 18, lineHeight: 1.5 }}>
            Withdrawing is a move on a specific note, so it starts from your portfolio. Waiting between winning and
            withdrawing is itself privacy — the longer the gap, the less the two look related.
          </div>

          <Link href="/v2/portfolio" style={{ ...ghostBtn, display: "block", textAlign: "center", textDecoration: "none" }}>
            PICK A NOTE IN PORTFOLIO
          </Link>
        </div>
      </div>

      {flow.state && (
        <FlowOverlay
          state={flow.state}
          onCancel={flow.close}
          onDone={(to) => {
            flow.close();
            router.push(to === "portfolio" ? "/v2/portfolio" : "/v2");
          }}
        />
      )}
    </main>
  );
}

const card: React.CSSProperties = {
  flex: 1,
  minWidth: 300,
  border: `1px solid ${line.base}`,
  background: c.panel,
  borderRadius: 12,
  padding: 26,
};

const eyebrow: React.CSSProperties = {
  fontFamily: font.mono,
  fontSize: 10,
  letterSpacing: "0.14em",
  color: c.faint,
  marginBottom: 6,
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  background: fill.gold,
  border: `1px solid ${line.goldStrong}`,
  color: c.text,
  fontFamily: font.mono,
  fontSize: 12.5,
  letterSpacing: "0.08em",
  padding: "14px 0",
  borderRadius: 8,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  width: "100%",
  background: "none",
  border: `1px solid ${line.strong}`,
  color: c.bright,
  fontFamily: font.mono,
  fontSize: 12.5,
  letterSpacing: "0.08em",
  padding: "14px 0",
  borderRadius: 8,
  cursor: "pointer",
};
