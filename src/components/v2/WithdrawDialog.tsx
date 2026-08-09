"use client";

import { useMemo, useState } from "react";
import { c, line, fill, font, breakdown, chunkSummary } from "@/lib/atrum/v2/tokens";
import { useSounds } from "@/lib/atrum/v2/feel";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";

/**
 * The door out.
 *
 * WITHDRAWALS ARE FIXED DENOMINATIONS, AND THAT IS A PRIVACY FEATURE. A payout of 327 leaving
 * as 327 identifies the position that earned it; leaving as 3×100 + 2×10 + 7×1 makes each
 * chunk identical to every other of its size on chain. So the interface shows the chunking
 * rather than hiding it, and lets a user deselect chunks to leave the rest sealed as change.
 *
 * ONE CHUNK PER TRANSACTION, because that is what the contract does -- `withdraw` takes a
 * single amount and mints a change note. Presenting a multi-chunk exit as one action would be
 * a lie about what lands on chain, so the dialog withdraws the largest selected chunk and says
 * what remains.
 */

export default function WithdrawDialog({
  noteId,
  amount,
  onClose,
}: {
  noteId: string;
  amount: number;
  onClose: () => void;
}) {
  const { withdraw, activity, error } = useMarket();
  const { address } = useWallet();
  const { thunk } = useSounds();

  const chunks = useMemo(() => breakdown(amount), [amount]);
  const [selected, setSelected] = useState<boolean[]>(() => chunks.map((_, i) => i === 0));
  const [recipient, setRecipient] = useState("");
  const [done, setDone] = useState<string | null>(null);

  // Only the largest selected chunk goes out in this transaction -- see the note above.
  const chosen = chunks.filter((_, i) => selected[i]);
  const thisExit = chosen.length > 0 ? Math.max(...chosen) : 0;
  const change = amount - thisExit;
  const to = recipient.trim() || address || "";
  const validTo = /^0x[0-9a-fA-F]{40}$/.test(to);

  const confirm = async () => {
    if (thisExit <= 0 || !validTo) return;
    thunk();
    await withdraw(noteId, thisExit, to);
    setDone(`${thisExit} exited to ${to.slice(0, 6)}…${to.slice(-4)}.`);
  };

  return (
    <div
      role="dialog"
      aria-label="Withdraw"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(9,10,12,0.96)",
        backdropFilter: "blur(8px)",
        zIndex: 110,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "v2FadeIn .25s ease",
      }}
    >
      <div style={{ maxWidth: 440, width: "100%" }}>
        {done ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 20px",
                border: `1.5px solid ${c.gold}`,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "v2Gravity .7s ease both",
              }}
            >
              <div style={{ width: 9, height: 9, background: c.gold, transform: "rotate(45deg)" }} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 12px" }}>Blended into the exits</h2>
            <p style={{ color: c.dim, fontSize: 13, lineHeight: 1.6, margin: "0 0 8px" }}>{done}</p>
            {change > 0 && (
              <p style={{ color: c.gold, fontSize: 13, margin: "0 0 8px" }}>{change} stays sealed as change.</p>
            )}
            <p style={{ color: c.faint, fontSize: 12, margin: "0 0 24px" }}>
              On chain, that chunk is indistinguishable from every other of its size.
            </p>
            <button onClick={onClose} style={primaryBtn}>
              DONE
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: "0.14em", color: c.gold, marginBottom: 8 }}>
              DOOR OUT
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>Exit as round chunks</h2>
            <p style={{ color: c.dim, fontSize: 13, lineHeight: 1.6, margin: "0 0 20px", textWrap: "pretty" }}>
              Your {amount} breaks into {chunkSummary(chunks)}. Each chunk is identical to every other of its size on
              chain — a withdrawal of {amount} would fingerprint you. One chunk leaves per transaction; the rest stays
              sealed.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
              {chunks.map((chunk, i) => {
                const on = selected[i];
                return (
                  <button
                    key={`${chunk}-${i}`}
                    onClick={() => setSelected((s) => s.map((v, j) => (j === i ? !v : v)))}
                    style={{
                      border: `1px solid ${on ? "rgba(200,164,101,0.55)" : "rgba(255,255,255,0.1)"}`,
                      background: on ? fill.gold : "none",
                      color: on ? c.text : c.faint,
                      fontFamily: font.mono,
                      fontSize: 15,
                      padding: "12px 20px",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all .15s",
                    }}
                  >
                    {chunk}
                  </button>
                );
              })}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: c.dim, marginBottom: 6 }}>To</div>
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={address ?? "0x…"}
                style={{
                  width: "100%",
                  background: c.well,
                  border: `1px solid ${validTo || !to ? line.strong : "rgba(208,112,95,0.6)"}`,
                  borderRadius: 8,
                  color: c.text,
                  fontFamily: font.mono,
                  fontSize: 13,
                  padding: "12px 14px",
                  outline: "none",
                }}
              />
              {/*
                A fresh address is the point: withdrawing to the address that deposited rejoins
                the two halves the pool spent effort separating.
              */}
              <div style={{ fontSize: 11.5, color: c.faint, marginTop: 6, lineHeight: 1.5 }}>
                Any address. A fresh one keeps this exit unlinked from the deposit that funded it.
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: c.dim, marginBottom: 6 }}>
              <span>Exits publicly now</span>
              <span style={{ fontFamily: font.mono, color: c.text }}>{thisExit}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: c.dim, marginBottom: 20 }}>
              <span>Stays sealed as change</span>
              <span style={{ fontFamily: font.mono, color: c.gold }}>{change}</span>
            </div>

            {error && <div style={{ color: c.red, fontSize: 12.5, marginBottom: 14, lineHeight: 1.5 }}>{error}</div>}

            <button
              onClick={confirm}
              disabled={thisExit <= 0 || !validTo || !!activity}
              style={{ ...primaryBtn, opacity: thisExit > 0 && validTo && !activity ? 1 : 0.4, cursor: activity ? "wait" : "pointer" }}
            >
              {activity ? "PROVING…" : `WITHDRAW ${thisExit} — VISIBLY`}
            </button>
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button onClick={onClose} style={{ background: "none", border: "none", color: c.faint, fontSize: 12, cursor: "pointer" }}>
                cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
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
