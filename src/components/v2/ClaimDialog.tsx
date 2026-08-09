"use client";

import EmblemMark from "@/components/atrum/logo/EmblemMark";
import { useEffect, useRef, useState } from "react";
import { c, line, fill, font } from "@/lib/atrum/v2/tokens";
import { scramble, randomCipher, useSounds, useReducedMotion } from "@/lib/atrum/v2/feel";
import { useMarket } from "@/lib/atrum/marketContext";

/**
 * Claiming a win.
 *
 * THE PAYOUT IS SHOWN BEFORE THE USER COMMITS, with weight. A won note holds its stake until
 * redeemed, so someone who staked 10 and is owed 32 sees "10" everywhere until the moment they
 * act -- and reads it as a break-even. The number here arrives with gravity because it is the
 * point of the whole product.
 *
 * Then the transmutation: the plaintext of the win scrambles into ciphertext while the real
 * redeem runs. Redeeming does not move collateral -- it spends one sealed note and mints
 * another -- so the animation is literal rather than decorative.
 */

type Stage = "preview" | "working" | "done";

export default function ClaimDialog({
  noteId,
  stake,
  payout,
  onClose,
}: {
  noteId: string;
  stake: number;
  payout: number;
  onClose: () => void;
}) {
  const { redeem, error } = useMarket();
  const { thunk } = useSounds();
  const reduced = useReducedMotion();

  const [stage, setStage] = useState<Stage>("preview");
  const [cipher, setCipher] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const plain = `WON · ${payout} UNITS · CLAIMING`;

  useEffect(() => {
    if (stage !== "working") return;
    const started = performance.now();
    const duration = reduced ? 300 : 1200;
    timer.current = setInterval(() => {
      const r = Math.min(1, (performance.now() - started) / duration);
      setCipher(r >= 1 ? randomCipher(plain.length) : scramble(plain, r));
      if (r >= 1 && timer.current) clearInterval(timer.current);
    }, 45);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [stage, plain, reduced]);

  const confirm = async () => {
    setStage("working");
    // The scramble runs alongside the real redeem: proof, relay, and a new note minted. It
    // finishes when the protocol does, not on a timer.
    await redeem(noteId);
    thunk();
    setStage("done");
  };

  return (
    <div
      role="dialog"
      aria-label="Claim your win"
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
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        {stage === "preview" && (
          <>
            <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: "0.14em", color: c.green, marginBottom: 18 }}>
              YOUR NOTE WON
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 15, color: c.faint, marginBottom: 6 }}>{stake} staked</div>
            <div
              style={{
                fontFamily: font.mono,
                fontSize: 76,
                fontWeight: 500,
                color: c.text,
                lineHeight: 1,
                animation: "v2Gravity .9s cubic-bezier(.2,.8,.3,1) both",
              }}
            >
              {payout}
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 13, color: c.green, margin: "10px 0 26px" }}>
              +{payout - stake} · {(payout / stake).toFixed(2)}×
            </div>
            <p style={{ color: c.dim, fontSize: 13, lineHeight: 1.6, margin: "0 0 24px", textWrap: "pretty" }}>
              Claiming mints a new sealed note. No collateral moves and nobody learns you won — withdrawal is a separate
              move, made whenever you choose.
            </p>
            <button onClick={confirm} style={confirmBtn}>
              CLAIM INTO A SEALED NOTE
            </button>
            <div style={{ marginTop: 14 }}>
              <button onClick={onClose} style={linkBtn}>
                not yet
              </button>
            </div>
          </>
        )}

        {stage === "working" && (
          <>
            <div
              style={{
                fontFamily: font.mono,
                fontSize: 16,
                color: c.gold,
                letterSpacing: "0.06em",
                minHeight: 24,
                wordBreak: "break-all",
              }}
            >
              {cipher}
            </div>
            <div style={{ marginTop: 16, fontFamily: font.mono, fontSize: 10.5, letterSpacing: "0.14em", color: c.faint }}>
              TRANSMUTING · OLD NOTE SPENT · NEW NOTE MINTED
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: c.faint }}>
              Proving on your machine, then relayed. This takes a moment.
            </div>
          </>
        )}

        {stage === "done" && (
          <>
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
              <EmblemMark style={{ height: 20, width: 20 * (691 / 789), color: c.gold }} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 10px" }}>
              {error ? "That did not go through" : "Sealed. Nobody saw it."}
            </h2>
            <p style={{ color: error ? c.red : c.dim, fontSize: 13, lineHeight: 1.6, margin: "0 0 24px", textWrap: "pretty" }}>
              {error ??
                "A withdrawal right now would mark you as the winner. Let it sit — the crowd around it only grows."}
            </p>
            <button onClick={onClose} style={confirmBtn}>
              {error ? "CLOSE" : "KEEP IT SEALED"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const confirmBtn: React.CSSProperties = {
  width: "100%",
  background: fill.green,
  border: `1px solid ${line.green}`,
  color: c.green,
  fontFamily: font.mono,
  fontSize: 13,
  letterSpacing: "0.1em",
  padding: "15px 0",
  borderRadius: 8,
  cursor: "pointer",
};

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: c.faint,
  fontSize: 12,
  cursor: "pointer",
};
