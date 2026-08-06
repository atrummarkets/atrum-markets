"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { color, font } from "@/lib/atrum/theme";
import { formatElapsed } from "@/lib/atrum/format";
import { useMarket } from "@/lib/atrum/marketContext";
import { Dialog, AtrumDialogContent } from "@/components/atrum/ui/Dialog";
import { DialogTitle } from "@/components/ui/dialog";
import BorderBeam from "@/components/atrum/ui/motion/BorderBeam";
import Spotlight from "@/components/atrum/ui/motion/Spotlight";

const TITLE = {
  deposit: "Depositing",
  bet: "Sealing",
  redeem: "Redeeming",
  withdraw: "Withdrawing",
} as const;

/**
 * Shows the REAL step and the REAL elapsed time.
 *
 * Deliberately no progress bar: proving happens in one blocking call on the server and emits
 * no intermediate progress, so any bar would be a decorative lie about how far along it is. The
 * elapsed clock is true, and the step text changes only when something actually changed. The
 * border beam is the same rule applied to the one bit of real-time signal that IS true: this is
 * still running. It never implies a percentage.
 */
export default function ActivityOverlay() {
  const { activity, config } = useMarket();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activity) return;
    const id = setInterval(() => setElapsed(Date.now() - activity.startedAt), 50);
    return () => clearInterval(id);
  }, [activity]);

  const circuit = activity
    ? activity.kind === "bet"
      ? config?.circuits.bet
      : activity.kind === "redeem"
        ? config?.circuits.redeem
        : activity.kind === "withdraw"
          ? config?.circuits.withdraw
          : config?.circuits.deposit
    : undefined;

  return (
    <AnimatePresence>
      {activity && (
        <Dialog open modal>
          <AtrumDialogContent aria-describedby={undefined}>
            <DialogTitle className="sr-only">{TITLE[activity.kind]}</DialogTitle>
            <Spotlight />
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-[640px] border border-hairline p-10"
              style={{ background: color.basalt }}
            >
              <BorderBeam />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 40 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ivory }}>
                  {TITLE[activity.kind]}
                </div>
                <div style={{ fontFamily: font.mono, fontSize: 15, color: color.pewter }}>{formatElapsed(elapsed)}</div>
              </div>

              <div style={{ fontFamily: font.display, fontSize: 30, lineHeight: 1.15, color: color.ivory, marginBottom: 24 }}>
                {activity.step}
              </div>

              {circuit && (
                <div style={{ fontFamily: font.mono, fontSize: 13, color: color.ash }}>
                  {circuit.name} · {circuit.constraints.toLocaleString()} constraints
                </div>
              )}

              <p style={{ margin: "32px 0 0", fontSize: 14, color: color.ash, maxWidth: "62ch" }}>
                There is no progress bar because the prover reports no progress. The clock above is real; a bar
                would not be.
              </p>
            </motion.div>
          </AtrumDialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
