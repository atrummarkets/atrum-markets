"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { color, font } from "@/lib/atrum/theme";
import { useOnboardingStep } from "@/lib/atrum/onboarding";

/**
 * Persistent, contextual "what do I do next" guidance -- the fix for HANDOFF.md's "there is no
 * first run". The step itself is derived from real wallet/note/pool state (see onboarding.ts);
 * dismissal here is UI-only chrome, not a substitute for that derivation, so it reappears the
 * moment the user's actual state changes (e.g. a new note lands) even if they dismissed a
 * previous step.
 *
 * `AnimatePresence` lives inside this component rather than at the call site: the hidden/visible
 * decision depends on hook state only this component has, and AnimatePresence can only animate an
 * exit if it directly sees the child disappear from its JSX -- a component that internally
 * returns null is invisible to a parent's AnimatePresence.
 */
export default function OnboardingBanner() {
  const step = useOnboardingStep();
  const pathname = usePathname();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const hidden =
    step.kind === "done" ||
    dismissedFor === step.kind ||
    // Don't tell someone to go to /boundary while they're already looking at /boundary.
    Boolean(step.link && pathname.startsWith(step.link.href));

  return (
    <AnimatePresence initial={false}>
      {!hidden && (
        <motion.div
          key={step.kind}
          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
          style={{ overflow: "hidden" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              padding: "16px 32px",
              background: color.basalt,
              borderBottom: `1px solid ${color.hairline}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: font.display, fontSize: 16, letterSpacing: "0.04em", color: color.ivory }}>
                {step.title}
              </div>
              <div style={{ fontSize: 13, color: color.smoke, marginTop: 2 }}>{step.detail}</div>
            </div>

            {step.action ? (
              <button
                onClick={step.action.run}
                style={{
                  padding: "10px 20px",
                  border: `1px solid ${color.hairlineStrong}`,
                  background: "none",
                  color: color.bone,
                  borderRadius: 2,
                  cursor: "pointer",
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
              >
                {step.action.label}
              </button>
            ) : step.link?.href.startsWith("http") ? (
              <a
                href={step.link.href}
                target="_blank"
                rel="noreferrer"
                style={{ padding: "10px 20px", border: `1px solid ${color.hairlineStrong}`, color: color.bone, borderRadius: 2, textDecoration: "none", fontSize: 13, whiteSpace: "nowrap" }}
              >
                {step.link.label}
              </a>
            ) : step.link ? (
              <Link
                href={step.link.href}
                style={{ padding: "10px 20px", border: `1px solid ${color.hairlineStrong}`, color: color.bone, borderRadius: 2, textDecoration: "none", fontSize: 13, whiteSpace: "nowrap" }}
              >
                {step.link.label}
              </Link>
            ) : null}

            <button
              onClick={() => setDismissedFor(step.kind)}
              aria-label="Dismiss"
              style={{ background: "none", border: 0, color: color.ash, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4 }}
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
