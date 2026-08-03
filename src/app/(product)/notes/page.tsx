"use client";

import { color, font } from "@/lib/atrum/theme";
import { useMarket } from "@/lib/atrum/marketContext";

const COLUMNS = "200px 1fr 160px 200px";

export default function NotesPage() {
  const { notes } = useMarket();

  return (
    <main style={{ padding: "96px 64px 128px", maxWidth: 1200 }}>
      <h2 style={{ fontFamily: font.display, fontWeight: 400, fontSize: "clamp(28px,3.4vw,42px)", letterSpacing: "0.02em", color: color.ivory, margin: "0 0 16px" }}>
        Your notes
      </h2>
      <p style={{ margin: "0 0 64px", fontSize: 20, color: color.smoke, maxWidth: "60ch" }}>
        There is no account and no balance. You hold notes — sealed objects with states. Each state permits
        different things.
      </p>

      <div style={{ border: `1px solid ${color.hairline}` }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: COLUMNS,
            gap: 32,
            padding: "16px 32px",
            borderBottom: `1px solid ${color.hairline}`,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
            color: color.ash,
          }}
        >
          <span>Note</span>
          <span>State</span>
          <span>Denomination</span>
          <span>Permits</span>
        </div>

        {notes.map((n) => (
          <div
            key={n.id}
            style={{
              display: "grid",
              gridTemplateColumns: COLUMNS,
              gap: 32,
              padding: 32,
              borderBottom: `1px solid ${color.hairline}`,
              alignItems: "center",
            }}
          >
            <span style={{ fontFamily: font.mono, fontSize: 15, color: color.pewter }}>{n.id}</span>
            <div>
              <div style={{ fontFamily: font.display, fontSize: 24, letterSpacing: "0.16em", color: n.stateColor }}>{n.state}</div>
              <div style={{ fontSize: 13, color: color.ash, marginTop: 4 }}>{n.detail}</div>
            </div>
            <span style={{ fontFamily: font.mono, fontSize: 15, color: color.bone }}>{n.amount}</span>
            <button
              disabled={!n.actionable}
              style={{
                padding: "12px 16px",
                border: `1px solid ${n.actionBorder}`,
                background: "none",
                color: n.actionColor,
                borderRadius: 2,
                cursor: n.actionable ? "pointer" : "not-allowed",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.16em",
              }}
            >
              {n.action}
            </button>
          </div>
        ))}
      </div>
      <p style={{ margin: "32px 0 0", fontSize: 15, color: color.ash, maxWidth: "70ch" }}>
        Redeem and withdraw are two steps and stay two steps. A parimutuel payout is an odd number set by your
        stake; paying it straight out would publish a figure that names your position exactly.
      </p>
    </main>
  );
}
