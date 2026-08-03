"use client";

import { color, font } from "@/lib/atrum/theme";
import { formatElapsed } from "@/lib/atrum/format";
import { useMarket } from "@/lib/atrum/marketContext";

const LATTICE_SIZE = 192;
const TOTAL_CONSTRAINTS = 1_048_576;

/** Sealing is the most technically remarkable moment in the product — it should not look like buffering. */
export default function ProvingOverlay() {
  const { stage, elapsedMs, constraintsSatisfied, step, provingSteps } = useMarket();
  if (stage !== "proving") return null;

  const filled = Math.round((constraintsSatisfied / TOTAL_CONSTRAINTS) * LATTICE_SIZE);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: color.void,
        backgroundImage:
          "radial-gradient(90% 55% at 50% 0%, rgba(240,217,176,0.06) 0%, rgba(6,7,10,0) 62%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 64,
        animation: "atrum-rise 260ms cubic-bezier(0.16,1,0.30,1)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 48 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ivory }}>
            Sealing
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 15, color: color.pewter }}>{formatElapsed(elapsedMs)}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(48,1fr)", gap: 2, marginBottom: 24 }}>
          {Array.from({ length: LATTICE_SIZE }, (_, i) => (
            <div
              key={i}
              style={{
                aspectRatio: "1",
                background: i < filled ? color.ivory : i < filled + 4 ? color.ash : color.graphite,
              }}
            />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingBottom: 24,
            borderBottom: `1px solid ${color.hairline}`,
          }}
        >
          <span style={{ fontSize: 13, color: color.ash }}>Constraints satisfied</span>
          <span style={{ fontFamily: font.mono, fontSize: 24, color: color.ivory }}>
            {constraintsSatisfied.toLocaleString("en-US")}
          </span>
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

        <div style={{ display: "flex", flexDirection: "column" }}>
          {provingSteps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div
                key={s.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "200px 1fr 88px",
                  gap: 24,
                  padding: "16px 0",
                  borderBottom: `1px solid ${color.hairline}`,
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    color: done ? color.smoke : active ? color.ivory : color.iron,
                  }}
                >
                  {s.label}
                </span>
                <span style={{ fontSize: 13, color: color.ash }}>{s.detail}</span>
                <span
                  style={{
                    fontFamily: font.mono,
                    fontSize: 13,
                    color: done ? color.ash : active ? color.pewter : color.iron,
                    textAlign: "right",
                  }}
                >
                  {done ? "done" : active ? "working" : "queued"}
                </span>
              </div>
            );
          })}
        </div>

        <p style={{ margin: "32px 0 0", fontSize: 13, color: color.ash, maxWidth: "62ch" }}>
          Nothing here is decorative. The finish time is not knowable in advance, so nothing pretends to know it.
        </p>
      </div>
    </div>
  );
}
