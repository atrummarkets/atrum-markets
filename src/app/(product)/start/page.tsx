"use client";

import { color, font, motion } from "@/lib/atrum/theme";
import { useOnboardingStep, type OnboardingStepKind } from "@/lib/atrum/onboarding";
import { useDetailMode } from "@/lib/atrum/detailMode";

/**
 * The guided first run HANDOFF.md's "0-quater" calls the biggest product gap. Where
 * OnboardingBanner gives a one-line nudge on every page, this is the full-page version: the
 * whole shape of the journey shown at once (so none of its five unfamiliar steps surprises
 * anyone), with the CURRENT step -- derived from real state, see onboarding.ts -- expanded and
 * actionable. `SEQUENCE`'s copy is duplicated in two altitudes rather than derived, same split
 * as `onboarding.ts`'s own simple/detailed dictionaries.
 */
const ORDER: OnboardingStepKind[] = [
  "connect",
  "switch-chain",
  "prerequisites",
  "deposit",
  "waiting-graft",
  "bet",
  "redeem",
  "withdraw",
  "done",
];

const SIMPLE_SEQUENCE: { kind: OnboardingStepKind; label: string; note: string }[] = [
  { kind: "connect", label: "Connect your wallet", note: "One signature. No transaction, no gas." },
  { kind: "prerequisites", label: "Get testnet funds", note: "MON for gas, plus some test collateral to trade with." },
  { kind: "deposit", label: "Add funds", note: "Moves collateral into your balance." },
  { kind: "waiting-graft", label: "Brief wait", note: "This is what keeps every trader private, including you." },
  { kind: "bet", label: "Trade", note: "Pick a market, choose a side." },
  { kind: "redeem", label: "Claim a win", note: "Claim it, then send it to your wallet whenever you like." },
  { kind: "withdraw", label: "Send to your wallet", note: "Waiting a bit before sending keeps it private." },
];

const DETAILED_SEQUENCE: { kind: OnboardingStepKind; label: string; note: string }[] = [
  { kind: "connect", label: "Connect your wallet", note: "One signature. No transaction, no gas." },
  { kind: "prerequisites", label: "Get testnet funds", note: "MON for gas (external faucet) and test collateral (in-app mint)." },
  { kind: "deposit", label: "Deposit", note: "Turns collateral into a note. There is no account balance, only notes." },
  { kind: "waiting-graft", label: "Wait for the graft", note: "Your note joins the anonymity set. The wait is the privacy, not latency." },
  { kind: "bet", label: "Bet", note: "Spends the WHOLE note on one side of one market -- no partial amount." },
  { kind: "redeem", label: "Redeem a win", note: "Mints a new shielded note. Does not pay you directly." },
  { kind: "withdraw", label: "Withdraw", note: "The note leaves as public collateral, to any address, whenever you choose." },
];

export default function StartPage() {
  const step = useOnboardingStep();
  const { mode } = useDetailMode();
  const SEQUENCE = mode === "detailed" ? DETAILED_SEQUENCE : SIMPLE_SEQUENCE;
  const currentIndex = ORDER.indexOf(step.kind);

  return (
    <main style={{ padding: "80px 64px 128px", maxWidth: 880 }}>
      <h1 style={{ fontFamily: font.display, fontWeight: 400, fontSize: "clamp(30px,3.6vw,46px)", color: color.ivory, margin: "0 0 16px" }}>
        Start here
      </h1>
      <p style={{ margin: "0 0 56px", fontSize: 19, color: color.smoke, maxWidth: "62ch" }}>
        {mode === "detailed"
          ? "Five steps, three of which have no analogue in a market you've used before. Here's the whole shape of it, so none of them reads as broken when you meet it."
          : "A few quick steps to your first trade. Here's the whole path, so nothing feels stuck along the way."}
      </p>

      {step.kind !== "done" && (
        <div style={{ padding: 32, marginBottom: 48, border: `1px solid ${color.hairlineStrong}`, background: color.basalt }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.halo, marginBottom: 12 }}>
            Next for you
          </div>
          <div style={{ fontFamily: font.display, fontSize: 26, color: color.ivory, marginBottom: 10 }}>{step.title}</div>
          <p style={{ margin: "0 0 24px", fontSize: 16, color: color.pewter, maxWidth: "62ch" }}>{step.detail}</p>
          {step.action && (
            <button
              onClick={step.action.run}
              style={{ padding: "16px 28px", border: 0, background: color.ivory, color: color.void, borderRadius: 2, cursor: "pointer", fontFamily: font.display, fontSize: 17, letterSpacing: "0.1em" }}
            >
              {step.action.label}
            </button>
          )}
          {step.link && (
            <a
              href={step.link.href}
              target={step.link.href.startsWith("http") ? "_blank" : undefined}
              rel={step.link.href.startsWith("http") ? "noreferrer" : undefined}
              style={{ display: "inline-block", padding: "16px 28px", border: 0, background: color.ivory, color: color.void, borderRadius: 2, textDecoration: "none", fontFamily: font.display, fontSize: 17, letterSpacing: "0.1em" }}
            >
              {step.link.label}
            </a>
          )}
        </div>
      )}

      {step.kind === "done" && (
        <div style={{ padding: 32, marginBottom: 48, border: `1px solid ${color.hairline}` }}>
          <p style={{ margin: 0, fontSize: 17, color: color.pewter }}>
            Nothing waiting on you right now -- your open positions are sealed until their market resolves.
          </p>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${color.hairline}` }}>
        {SEQUENCE.map((s, i) => {
          const stageIndex = ORDER.indexOf(s.kind);
          const state = stageIndex < currentIndex ? "done" : stageIndex === currentIndex ? "current" : "upcoming";
          return (
            <div
              key={s.kind}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 24,
                padding: "20px 0",
                borderBottom: `1px solid ${color.hairline}`,
                opacity: state === "upcoming" ? 0.45 : 1,
                transition: `opacity ${motion.local}`,
              }}
            >
              <span
                style={{
                  fontFamily: font.mono,
                  fontSize: 13,
                  width: 24,
                  color: state === "current" ? color.halo : state === "done" ? color.ivory : color.iron,
                }}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <div>
                <div style={{ fontSize: 16, color: state === "current" ? color.ivory : color.pewter }}>{s.label}</div>
                <div style={{ fontSize: 13, color: color.ash, marginTop: 2 }}>{s.note}</div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
