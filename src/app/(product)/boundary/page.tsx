"use client";

import { color, font, CHIP_DENOMINATIONS, DECLARED_GAS_LIMIT } from "@/lib/atrum/theme";
import { queueTicks } from "@/lib/atrum/ticks";
import TickBar from "@/components/atrum/TickBar";

const QUEUE_POSITION = 41;

export default function BoundaryPage() {
  return (
    <main style={{ padding: "96px 64px 128px", maxWidth: 1200 }}>
      <h2 style={{ fontFamily: font.display, fontWeight: 400, fontSize: "clamp(28px,3.4vw,42px)", letterSpacing: "0.02em", color: color.ivory, margin: "0 0 16px" }}>
        The public boundary
      </h2>
      <p style={{ margin: "0 0 64px", fontSize: 20, color: color.smoke, maxWidth: "60ch" }}>
        Deposits and withdrawals happen on the open chain with your address on them. That is true now and will
        stay true. Everything between them is sealed.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(380px,1fr))", gap: 1, background: color.hairline, border: `1px solid ${color.hairline}` }}>
        <div style={{ background: color.basalt, padding: 48 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 24 }}>
            Deposit · public
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
            {CHIP_DENOMINATIONS.map((v) => (
              <div
                key={v}
                style={{
                  padding: "20px 8px",
                  border: `1px solid ${color.hairline}`,
                  color: color.pewter,
                  textAlign: "center",
                  fontFamily: font.mono,
                  fontSize: 15,
                }}
              >
                {v}
              </div>
            ))}
          </div>
          <p style={{ margin: "0 0 32px", fontSize: 15, color: color.smoke }}>
            Your address and the amount are visible to everyone, permanently. Only fixed denominations exist,
            because an unusual amount is a signature.
          </p>
          <button
            style={{
              width: "100%",
              padding: 24,
              border: 0,
              background: color.ivory,
              color: color.void,
              borderRadius: 2,
              cursor: "pointer",
              fontFamily: font.display,
              fontSize: 24,
              letterSpacing: "0.16em",
            }}
          >
            DEPOSIT 100 MON
          </button>

          <div style={{ marginTop: 48, borderTop: `1px solid ${color.hairline}`, paddingTop: 32 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 24 }}>
              The queue
            </div>
            <div style={{ marginBottom: 8 }}>
              <TickBar ticks={queueTicks(QUEUE_POSITION)} height={24} grow />
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 15, color: color.pewter, marginBottom: 16 }}>
              {QUEUE_POSITION} notes ahead of yours · batch of 64
            </div>
            <p style={{ margin: 0, fontSize: 15, color: color.smoke }}>
              You cannot bet until it lands. This is not latency. It is your note entering the tree beside
              sixty-three others, which is the whole of what makes it indistinguishable. The privacy is being
              manufactured in front of you.
            </p>
          </div>
        </div>

        <div style={{ background: color.basalt, padding: 48 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 24 }}>
            Withdraw · public
          </div>
          <p style={{ margin: "0 0 32px", fontSize: 15, color: color.smoke }}>
            A settled note leaves in a fixed denomination, to any address you name, at any hour you choose.
            Waiting is itself privacy: the longer between redeeming and withdrawing, the less the two look
            related.
          </p>
          <div style={{ borderTop: `1px solid ${color.hairline}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: `1px solid ${color.hairline}` }}>
              <span style={{ fontSize: 15, color: color.smoke }}>Settled notes</span>
              <span style={{ fontFamily: font.mono, fontSize: 15, color: color.bone }}>2 · 200 MON</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: `1px solid ${color.hairline}` }}>
              <span style={{ fontSize: 15, color: color.smoke }}>Withdrawals of this size, last hour</span>
              <span style={{ fontFamily: font.mono, fontSize: 15, color: color.bone }}>31</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: `1px solid ${color.hairline}` }}>
              <span style={{ fontSize: 15, color: color.smoke }}>Gas limit</span>
              <span style={{ fontFamily: font.mono, fontSize: 15, color: color.bone }}>{DECLARED_GAS_LIMIT}</span>
            </div>
          </div>
          <button
            style={{
              marginTop: 32,
              width: "100%",
              padding: 24,
              border: `1px solid ${color.hairlineStrong}`,
              background: "none",
              color: color.bone,
              borderRadius: 2,
              cursor: "pointer",
              fontFamily: font.display,
              fontSize: 24,
              letterSpacing: "0.16em",
            }}
          >
            WITHDRAW 100 MON
          </button>
          <p style={{ margin: "16px 0 0", fontSize: 13, color: color.ash }}>
            Thirty-one withdrawals of this size landed in the last hour. Yours will look like the thirty-second.
          </p>
        </div>
      </div>
    </main>
  );
}
