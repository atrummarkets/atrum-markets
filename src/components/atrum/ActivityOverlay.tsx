"use client";

import { useEffect, useState } from "react";
import { color, font } from "@/lib/atrum/theme";
import { formatElapsed } from "@/lib/atrum/format";
import { useMarket } from "@/lib/atrum/marketContext";

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
 * no intermediate progress, so any bar would be a decorative lie about how far along it is.
 * The elapsed clock is true, and the step text changes only when something actually changed.
 */
export default function ActivityOverlay() {
  const { activity, config } = useMarket();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activity) return;
    const id = setInterval(() => setElapsed(Date.now() - activity.startedAt), 50);
    return () => clearInterval(id);
  }, [activity]);

  if (!activity) return null;

  const circuit =
    activity.kind === "bet" ? config?.circuits.bet
    : activity.kind === "redeem" ? config?.circuits.redeem
    : activity.kind === "withdraw" ? config?.circuits.withdraw
    : config?.circuits.deposit;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: color.void,
        backgroundImage: "radial-gradient(90% 55% at 50% 0%, rgba(240,217,176,0.06) 0%, rgba(6,7,10,0) 62%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 64,
        animation: "atrum-rise 200ms cubic-bezier(0.16,1,0.30,1)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 640 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 40 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ivory }}>
            {TITLE[activity.kind]}
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 15, color: color.pewter }}>{formatElapsed(elapsed)}</div>
        </div>

        <div style={{ height: 1, background: color.slate, overflow: "hidden", marginBottom: 32 }}>
          <div
            style={{
              height: 1,
              width: "18%",
              background: color.ivory,
              animation: "atrum-sweep 1600ms cubic-bezier(0.65,0,0.35,1) infinite",
            }}
          />
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
          There is no progress bar because the prover reports no progress. The clock above is real; a bar would
          not be.
        </p>
      </div>
    </div>
  );
}
