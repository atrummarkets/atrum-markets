"use client";

import { useState } from "react";
import { color, font } from "@/lib/atrum/theme";
import { formatBytes } from "@/lib/atrum/format";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";

const RUNGS = [1, 10, 100, 1000];

export default function BoundaryPage() {
  const { config, pool, notes, walletUnits, deposit, faucet, activity, error, clearError } = useMarket();
  const { session, address, connect, connecting } = useWallet();
  const [units, setUnits] = useState(100);

  const symbol = config?.token.symbol ?? "";
  const settled = notes.filter((n) => n.outcome === 3 && n.status === "grafted");
  const settledUnits = settled.reduce((a, n) => a + Number(n.units), 0);
  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

  return (
    <main style={{ padding: "80px 64px 128px", maxWidth: 1200 }}>
      <h1 style={{ fontFamily: font.display, fontWeight: 400, fontSize: "clamp(30px,3.6vw,46px)", color: color.ivory, margin: "0 0 16px" }}>
        The public boundary
      </h1>
      <p style={{ margin: "0 0 56px", fontSize: 19, color: color.smoke, maxWidth: "62ch" }}>
        Deposits and withdrawals happen on the open chain with your address on them. That is true now and will
        stay true — the pool pulls collateral from you, so whoever pays is visible. Everything between them is
        sealed.
      </p>

      {error && (
        <div style={{ marginBottom: 32, padding: 18, border: `1px solid ${color.ember}`, color: color.ember, fontSize: 15, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{error}</span>
          <button onClick={clearError} style={{ background: "none", border: 0, color: color.ash, cursor: "pointer", textDecoration: "underline" }}>
            dismiss
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(400px,1fr))", gap: 1, background: color.hairline, border: `1px solid ${color.hairline}` }}>
        {/* ---------------- deposit ---------------- */}
        <div style={{ background: color.basalt, padding: 40 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 20 }}>
            Deposit · public · your wallet signs
          </div>

          {!session ? (
            <>
              <p style={{ margin: "0 0 24px", fontSize: 16, color: color.pewter }}>
                Connect a wallet to deposit. You will sign a message first so we can hand back your notes.
              </p>
              <button
                onClick={connect}
                disabled={connecting}
                style={{ width: "100%", padding: 20, border: 0, background: color.ivory, color: color.void, borderRadius: 2, cursor: "pointer", fontFamily: font.display, fontSize: 20, letterSpacing: "0.14em" }}
              >
                {connecting ? "CONNECTING…" : "CONNECT WALLET"}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: color.smoke, marginBottom: 20 }}>
                <span>Your balance</span>
                <span style={{ fontFamily: font.mono, color: color.bone }}>
                  {walletUnits === null ? "—" : `${walletUnits} ${symbol}`}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: `repeat(${RUNGS.length},1fr)`, gap: 8, marginBottom: 12 }}>
                {RUNGS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setUnits(r)}
                    style={{
                      padding: "18px 8px",
                      border: `1px solid ${units === r ? color.ivory : color.hairline}`,
                      background: units === r ? color.ivory : "transparent",
                      color: units === r ? color.void : color.pewter,
                      borderRadius: 2,
                      cursor: "pointer",
                      fontFamily: font.mono,
                      fontSize: 15,
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p style={{ margin: "0 0 28px", fontSize: 14, color: color.smoke }}>
                Powers of ten only, enforced on chain. An unusual amount is a signature — and it shrinks the set
                for everyone else, not just for you.
              </p>

              {walletUnits !== null && walletUnits < units && (
                <button
                  onClick={() => faucet(1000)}
                  disabled={!!activity}
                  style={{ width: "100%", padding: 16, marginBottom: 8, border: `1px solid ${color.hairlineStrong}`, background: "none", color: color.bone, borderRadius: 2, cursor: activity ? "wait" : "pointer", fontSize: 15 }}
                >
                  {activity ? "Working…" : `Get 1,000 test ${symbol}`}
                </button>
              )}

              {(() => {
                // Never enable the button on an unknown balance: clicking would build a proof
                // and then fail at the transaction, which reads as a broken app rather than
                // an empty wallet.
                const unknown = walletUnits === null;
                const short = walletUnits !== null && walletUnits < units;
                const blocked = !!activity || unknown || short;
                return (
                  <button
                    onClick={() => deposit(units)}
                    disabled={blocked}
                    style={{
                      width: "100%",
                      padding: 20,
                      border: 0,
                      background: blocked ? color.graphite : color.ivory,
                      color: blocked ? color.ash : color.void,
                      borderRadius: 2,
                      cursor: activity ? "wait" : blocked ? "not-allowed" : "pointer",
                      fontFamily: font.display,
                      fontSize: 20,
                      letterSpacing: "0.14em",
                    }}
                  >
                    {activity ? "WORKING…" : unknown ? "READING BALANCE…" : short ? `NEED ${units} ${symbol}` : `DEPOSIT ${units}`}
                  </button>
                );
              })()}
              <p style={{ margin: "14px 0 0", fontSize: 13, color: color.ash }}>
                You need a little testnet MON for gas — get it at{" "}
                <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer" style={{ color: color.pewter }}>
                  faucet.monad.xyz
                </a>
                . Betting, redeeming and withdrawing after this cost you no gas at all: a relayer pays.
              </p>
            </>
          )}

          <div style={{ marginTop: 40, borderTop: `1px solid ${color.hairline}`, paddingTop: 28 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 16 }}>
              The queue
            </div>
            {pool ? (
              <>
                <div style={{ fontFamily: font.mono, fontSize: 15, color: color.pewter, marginBottom: 12 }}>
                  {pool.queuedCount} note{pool.queuedCount === 1 ? "" : "s"} waiting · {pool.batchCount} batches
                  grafted · batch of 64
                </div>
                <p style={{ margin: 0, fontSize: 15, color: color.smoke }}>
                  You cannot bet until your note lands in the tree. That is not latency — it is your note entering
                  beside others, which is the whole of what makes it indistinguishable.
                </p>
              </>
            ) : (
              <div style={{ fontSize: 15, color: color.ash }}>Reading the pool…</div>
            )}
          </div>
        </div>

        {/* ---------------- withdraw ---------------- */}
        <div style={{ background: color.basalt, padding: 40 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 20 }}>
            Withdraw · public · relayed
          </div>
          <p style={{ margin: "0 0 28px", fontSize: 16, color: color.pewter }}>
            A settled note leaves in a fixed denomination, to any address you name, at any hour you choose.
            Waiting is itself privacy: the longer between redeeming and withdrawing, the less the two look
            related.
          </p>

          <div style={{ borderTop: `1px solid ${color.hairline}` }}>
            {[
              ["Your settled notes", session ? `${settled.length} · ${settledUnits} units` : "connect to see"],
              ["Your address", address ? short(address) : "—"],
              ["Gas you pay", "none — a relayer submits it"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${color.hairline}` }}>
                <span style={{ fontSize: 15, color: color.smoke }}>{k}</span>
                <span style={{ fontFamily: font.mono, fontSize: 14, color: color.bone }}>{v}</span>
              </div>
            ))}
          </div>

          <p style={{ margin: "24px 0 0", fontSize: 15, color: color.smoke }}>
            Withdrawals start from a settled note on{" "}
            <a href="/notes" style={{ color: color.halo }}>
              your notes
            </a>
            , because the note is what carries the value — there is no account balance to draw from.
          </p>

          {config && (
            <div style={{ marginTop: 32, borderTop: `1px solid ${color.hairline}`, paddingTop: 24 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 14 }}>
                What proves it
              </div>
              {Object.entries(config.circuits).map(([k, c]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}>
                  <span style={{ color: color.smoke }}>{c.name}</span>
                  <span style={{ fontFamily: font.mono, color: color.ash }}>
                    {c.constraints.toLocaleString()} constraints · {formatBytes(c.zkeyBytes)} key
                  </span>
                </div>
              ))}
              <p style={{ margin: "16px 0 0", fontSize: 13, color: color.ash }}>
                These proofs are built on the server, which therefore sees your note secrets. The production
                design proves in your browser instead — that is a real difference, and this deployment is on the
                wrong side of it.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
