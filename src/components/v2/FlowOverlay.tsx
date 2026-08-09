"use client";

import { useEffect, useRef, useState } from "react";
import { c, line, fill, font, FLOW_LABELS, FLOW_STEPS, type FlowStep } from "@/lib/atrum/v2/tokens";
import { scramble, randomCipher, useReducedMotion } from "@/lib/atrum/v2/feel";
import CrowdCanvas from "./CrowdCanvas";
import ProofCanvas from "./ProofCanvas";

/**
 * The five steps of a bet, shown while they actually happen.
 *
 * NOT A PROGRESS BAR WITH SCENERY. Each step is driven by the real action underneath:
 * `batchProgress` comes from the sequencer grafting the note, `proveProgress` from the circuit
 * download and the worker, and the receipt shows the transaction that actually landed. The
 * prototype compressed these timings for a demo; here the animation waits on the protocol
 * rather than the other way round.
 *
 * ADAPTIVE. A user who already holds a grafted note skips DEPOSIT and BATCH -- those steps are
 * a deposit's story, not a bet's -- and starts at PROVE. Showing five steps and instantly
 * ticking two of them off would be theatre.
 */

export interface FlowState {
  step: FlowStep;
  /** Which steps this run actually includes. A repeat bettor sees three, not five. */
  steps: readonly FlowStep[];
  /** 0..1. Batch assembly, from the real graft poll. */
  batchProgress: number;
  /** Live anonymity set size, read from the pool. Never invented. */
  anonymitySet: number | null;
  /** 0..1 across artifact download and proving. */
  proveProgress: number;
  /** What the prover is doing right now, in its own words. */
  proveLabel: string;
  /** Human summary of what is being sealed, e.g. "YES · 100 units · Will BTC…". */
  sealPlaintext: string;
  /** Populated once the action lands. */
  receipt?: { txHash: string; relayer?: string; provingMs?: number };
  error?: string;
}

const railColor = (i: number, current: number) =>
  i === current ? c.gold : i < current ? c.bright : c.ghost;

function Rail({ steps, step }: { steps: readonly FlowStep[]; step: FlowStep }) {
  const current = steps.indexOf(step);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "26px 20px 0" }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              fontFamily: font.mono,
              fontSize: 10.5,
              letterSpacing: "0.12em",
              color: railColor(i, current),
              padding: "0 4px",
              transition: "color .4s",
            }}
          >
            {FLOW_LABELS[s]}
          </div>
          {i < steps.length - 1 && (
            <div
              style={{
                width: 28,
                height: 1,
                margin: "0 6px",
                background: i < current ? "rgba(185,191,200,0.4)" : line.faint,
                transition: "background .4s",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function FlowOverlay({
  state,
  onCancel,
  onDone,
}: {
  state: FlowState;
  onCancel: () => void;
  onDone: (to: "portfolio" | "markets") => void;
}) {
  const reduced = useReducedMotion();
  const { step } = state;

  // --- seal: plaintext dissolving into ciphertext ---
  const [sealText, setSealText] = useState(state.sealPlaintext);
  const [sealPhase, setSealPhase] = useState(0);
  const sealTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (step !== "sealing") return;
    const plain = state.sealPlaintext;
    const started = performance.now();
    const duration = reduced ? 300 : 1300;
    setSealPhase(0);

    sealTimer.current = setInterval(() => {
      const r = Math.min(1, (performance.now() - started) / duration);
      if (r >= 1) {
        if (sealTimer.current) clearInterval(sealTimer.current);
        setSealText(randomCipher(plain.length));
        setSealPhase(1);
        // The deliberate stillness. The caption arrives after the seal has landed, not with it.
        setTimeout(() => setSealPhase(2), 500);
      } else {
        setSealText(scramble(plain, r));
      }
    }, 45);

    return () => {
      if (sealTimer.current) clearInterval(sealTimer.current);
    };
  }, [step, state.sealPlaintext, reduced]);

  const sealed = sealPhase >= 1;

  return (
    <div
      role="dialog"
      aria-label="Placing your bet"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(9,10,12,0.97)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        animation: "v2FadeIn .25s ease",
      }}
    >
      <Rail steps={state.steps} step={step} />

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        {state.error ? (
          <div style={{ maxWidth: 460, textAlign: "center" }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 10px", color: c.red }}>That did not go through</h2>
            <p style={{ color: c.dim, fontSize: 13.5, lineHeight: 1.6, margin: "0 0 26px" }}>{state.error}</p>
            <button onClick={onCancel} style={ghostBtn}>
              CLOSE
            </button>
          </div>
        ) : step === "deposit" ? (
          <Deposit state={state} onCancel={onCancel} />
        ) : step === "batching" ? (
          <Batching state={state} reduced={reduced} />
        ) : step === "proving" ? (
          <Proving state={state} />
        ) : step === "sealing" ? (
          <Sealing text={sealText} sealed={sealed} phase={sealPhase} />
        ) : (
          <Receipt state={state} onDone={onDone} />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- deposit */

function Deposit({ state, onCancel }: { state: FlowState; onCancel: () => void }) {
  // The doors are shut for the whole step: this screen is shown while the wallet transaction
  // is in flight, so "crossing" is the honest state, not an idle prompt.
  return (
    <div style={{ maxWidth: 460, textAlign: "center", animation: "v2FadeUp .4s ease" }}>
      <div
        style={{
          position: "relative",
          width: 220,
          height: 150,
          margin: "0 auto 32px",
          border: `1px solid ${line.strong}`,
          borderRadius: 8,
          overflow: "hidden",
          background: c.void,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font.mono,
            fontSize: 22,
            color: c.gold,
          }}
        >
          {state.sealPlaintext}
        </div>
        <div style={{ ...doorFace, left: 0, borderRight: `1px solid ${line.goldStrong}`, transform: "translateX(0%)" }} />
        <div style={{ ...doorFace, right: 0, borderLeft: `1px solid ${line.goldStrong}`, transform: "translateX(0%)" }} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 10px" }}>This is the last public step</h2>
      <p style={{ color: c.dim, fontSize: 13.5, lineHeight: 1.6, margin: "0 0 26px", textWrap: "pretty" }}>
        Collateral leaves your address on-chain, visibly and permanently — the pool pulls it from you, so whoever pays
        is public. Everything after this door is sealed.
      </p>
      <div style={{ fontFamily: font.mono, fontSize: 12, letterSpacing: "0.1em", color: c.gold }}>
        CONFIRM IN YOUR WALLET…
      </div>
      <div style={{ marginTop: 16 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: c.faint, fontSize: 12, cursor: "pointer" }}>
          cancel
        </button>
      </div>
    </div>
  );
}

const doorFace: React.CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: "50%",
  background: c.doorFace,
  transition: "transform .9s cubic-bezier(.7,0,.3,1)",
};

/* --------------------------------------------------------------- batching */

function Batching({ state, reduced }: { state: FlowState; reduced: boolean }) {
  const pct = Math.floor(state.batchProgress * 100);
  return (
    <div style={{ maxWidth: 640, width: "100%", textAlign: "center", animation: "v2FadeUp .4s ease" }}>
      <CrowdCanvas progress={state.batchProgress} reducedMotion={reduced} />
      <div style={{ display: "flex", justifyContent: "center", gap: 48, margin: "8px 0 18px", flexWrap: "wrap" }}>
        <Stat
          value={state.anonymitySet === null ? "—" : state.anonymitySet.toLocaleString("en-US")}
          label="NOTES YOURS IS HIDDEN AMONG"
        />
        <Stat value={`${pct}%`} label="BATCH ASSEMBLING" gold />
      </div>
      <p style={{ color: c.dim, fontSize: 13.5, margin: 0, textWrap: "pretty" }}>
        {state.batchProgress >= 1
          ? "Batch sealed. Your note is now indistinguishable from every other note in the set."
          : "Your note is being mixed into the crowd. The gold fades as it loses its distinguishing features."}
      </p>
      <p style={{ color: c.faint, fontSize: 12, margin: "10px 0 0" }}>
        This wait is not latency. It is the privacy being made.
      </p>
    </div>
  );
}

function Stat({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: font.mono, fontSize: 34, fontWeight: 500, color: gold ? c.gold : c.text }}>{value}</div>
      <div style={{ fontFamily: font.mono, fontSize: 10.5, letterSpacing: "0.12em", color: c.faint, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- proving */

function Proving({ state }: { state: FlowState }) {
  // Constraint count is the real figure for bet_encrypted, scaled by real progress -- the
  // number climbs because work is happening, not because a timer is running.
  const constraints = Math.round(state.proveProgress * 21252);
  return (
    <div style={{ maxWidth: 640, width: "100%", textAlign: "center", animation: "v2FadeUp .3s ease" }}>
      <ProofCanvas progress={state.proveProgress} />
      <div style={{ fontFamily: font.mono, fontSize: 38, fontWeight: 500, color: c.text, marginTop: 6 }}>
        {constraints.toLocaleString("en-US")}
        <span style={{ fontSize: 14, color: c.faint }}> / 21,252</span>
      </div>
      <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: "0.14em", color: c.gold, marginTop: 6 }}>
        {state.proveLabel}
      </div>
      <p style={{ color: c.dim, fontSize: 13, margin: "14px 0 0" }}>
        This is running on your machine. Nothing secret leaves it.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- sealing */

function Sealing({ text, sealed, phase }: { text: string; sealed: boolean; phase: number }) {
  return (
    <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
      <div
        style={{
          border: `1px solid ${sealed ? line.goldStrong : line.strong}`,
          borderRadius: 12,
          background: c.sealPanel,
          padding: "34px 28px",
          transform: `scale(${sealed ? 0.94 : 1})`,
          transition: "transform .7s cubic-bezier(.6,0,.2,1), border-color .7s",
        }}
      >
        <div style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: "0.16em", color: c.faint, marginBottom: 14 }}>
          {sealed ? "CIPHERTEXT · SEALED" : "PLAINTEXT · SEALING"}
        </div>
        <div
          style={{
            fontFamily: font.mono,
            fontSize: 17,
            letterSpacing: "0.04em",
            color: sealed ? c.gold : c.text,
            minHeight: 24,
            wordBreak: "break-all",
          }}
        >
          {text}
        </div>
      </div>
      <div style={{ marginTop: 22, fontSize: 13, color: c.faint, opacity: phase >= 2 ? 1 : 0, transition: "opacity .6s" }}>
        Irreversible. The plaintext no longer exists anywhere.
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- receipt */

function Receipt({ state, onDone }: { state: FlowState; onDone: (to: "portfolio" | "markets") => void }) {
  const r = state.receipt;
  return (
    <div style={{ maxWidth: 480, width: "100%" }}>
      <div style={{ textAlign: "center", marginBottom: 30, animation: "v2FadeUp .5s ease both" }}>
        <div style={{ width: 64, height: 64, margin: "0 auto 18px", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, border: `1px solid ${line.goldStrong}`, borderRadius: "50%", animation: "v2RingPulse 1.4s ease-out both" }} />
          <div style={{ width: 44, height: 44, border: `1.5px solid ${c.gold}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 9, height: 9, background: c.gold, transform: "rotate(45deg)" }} />
          </div>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Your bet is placed. Here is what stayed hidden.</h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Fact delay=".25s" title="A transaction exists." detail={r?.txHash ?? "—"} />
        <Fact
          delay=".55s"
          title="Your address is not on it."
          detail={r?.relayer ? `submitted by relayer ${r.relayer}` : "submitted by a relayer"}
        />
        {state.anonymitySet !== null && (
          <Fact
            delay=".85s"
            gold
            title={`${state.anonymitySet.toLocaleString("en-US")} notes could have been this one.`}
            detail="anonymity set at inclusion — readable from chain"
          />
        )}
        {r?.provingMs !== undefined && (
          <Fact
            delay="1.1s"
            title="Proved on your machine."
            detail={`21,252 constraints in ${(r.provingMs / 1000).toFixed(1)}s — no secret left the browser`}
          />
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 24, animation: "v2FadeUp .5s ease both", animationDelay: "1.2s" }}>
        <button onClick={() => onDone("portfolio")} style={goldBtn}>
          VIEW YOUR NOTES
        </button>
        <button onClick={() => onDone("markets")} style={ghostBtn}>
          BACK TO THE FLOOR
        </button>
      </div>
    </div>
  );
}

function Fact({ title, detail, delay, gold }: { title: string; detail: string; delay: string; gold?: boolean }) {
  return (
    <div
      style={{
        border: `1px solid ${gold ? "rgba(200,164,101,0.3)" : line.base}`,
        background: gold ? fill.goldFaint : "none",
        borderRadius: 9,
        padding: "14px 18px",
        animation: "v2FadeUp .5s ease both",
        animationDelay: delay,
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 3 }}>{title}</div>
      <div style={{ fontFamily: font.mono, fontSize: 11, color: c.faint, wordBreak: "break-all" }}>{detail}</div>
    </div>
  );
}

const goldBtn: React.CSSProperties = {
  flex: 1,
  background: fill.gold,
  border: `1px solid ${line.green.replace("61,190,139", "200,164,101")}`,
  color: c.text,
  fontFamily: font.mono,
  fontSize: 12.5,
  letterSpacing: "0.08em",
  padding: "14px 0",
  borderRadius: 8,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  flex: 1,
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
