import { color, font, motion, CHIP_DENOMINATIONS, DECLARED_GAS_LIMIT } from "@/lib/atrum/theme";
import type { Side } from "@/lib/atrum/types";

export default function BetTicket({
  side,
  denom,
  cached,
  onPickSide,
  onPickDenom,
  onSeal,
}: {
  side: Side | null;
  denom: number;
  cached: boolean;
  onPickSide: (side: Side) => void;
  onPickDenom: (denom: number) => void;
  onSeal: () => void;
}) {
  const ready = side !== null;
  const transition = `background ${motion.control}, border-color ${motion.control}, color ${motion.control}`;

  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 24 }}>
        Take a position
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          onClick={() => onPickSide("yes")}
          style={{
            padding: "32px 16px",
            border: `1px solid ${side === "yes" ? color.ivory : color.hairlineStrong}`,
            background: side === "yes" ? color.ivory : "transparent",
            color: side === "yes" ? color.void : color.ivory,
            borderRadius: 2,
            cursor: "pointer",
            fontFamily: font.display,
            fontSize: 24,
            letterSpacing: "0.16em",
            textAlign: "left",
            transition,
          }}
        >
          YES
        </button>
        <button
          onClick={() => onPickSide("no")}
          style={{
            padding: "32px 16px",
            border: `1px solid ${side === "no" ? color.ash : color.hairline}`,
            background: side === "no" ? color.ash : "transparent",
            color: side === "no" ? color.void : color.smoke,
            borderRadius: 2,
            cursor: "pointer",
            fontFamily: font.display,
            fontSize: 24,
            letterSpacing: "0.16em",
            textAlign: "left",
            transition,
          }}
        >
          NO
        </button>
      </div>

      <div style={{ marginTop: 32, marginBottom: 16, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>
        Chips
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {CHIP_DENOMINATIONS.map((v) => (
          <button
            key={v}
            onClick={() => onPickDenom(v)}
            style={{
              padding: "20px 8px",
              border: `1px solid ${denom === v ? color.ivory : color.hairline}`,
              background: denom === v ? color.ivory : "transparent",
              color: denom === v ? color.void : color.pewter,
              borderRadius: 2,
              cursor: "pointer",
              fontFamily: font.mono,
              fontSize: 15,
              transition,
            }}
          >
            {v}
          </button>
        ))}
      </div>
      <p style={{ margin: "16px 0 0", fontSize: 13, color: color.ash }}>
        The house deals in chips. An unusual amount is a name tag — and it shrinks the set for everyone else, not
        only for you.
      </p>

      <div style={{ marginTop: 32, borderTop: `1px solid ${color.hairline}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: `1px solid ${color.hairline}` }}>
          <span style={{ fontSize: 15, color: color.smoke }}>Stake</span>
          <span style={{ fontFamily: font.mono, fontSize: 15, color: color.bone }}>{denom} MON</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: `1px solid ${color.hairline}` }}>
          <span style={{ fontSize: 15, color: color.smoke }}>Gas limit</span>
          <span style={{ fontFamily: font.mono, fontSize: 15, color: color.bone }}>{DECLARED_GAS_LIMIT}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: `1px solid ${color.hairline}` }}>
          <span style={{ fontSize: 15, color: color.smoke }}>Proof</span>
          <span style={{ fontFamily: font.mono, fontSize: 15, color: color.bone }}>
            {cached ? "cached · ~2–4s" : "11.8 MB · ~2–5s"}
          </span>
        </div>
      </div>

      <button
        onClick={onSeal}
        disabled={!ready}
        style={{
          marginTop: 32,
          width: "100%",
          padding: 24,
          border: `1px solid ${ready ? color.ivory : color.hairline}`,
          background: ready ? color.ivory : "transparent",
          color: ready ? color.void : color.ash,
          borderRadius: 2,
          cursor: ready ? "pointer" : "not-allowed",
          fontFamily: font.display,
          fontSize: 24,
          letterSpacing: "0.16em",
          transition: `background ${motion.control}, color ${motion.control}`,
        }}
      >
        SEAL
      </button>
      <p style={{ margin: "16px 0 0", fontSize: 13, color: color.ash }}>
        {ready
          ? cached
            ? "The circuit is cached on this device. Proving runs here, then a relayer submits."
            : "The bet circuit is 11.8 MB and downloads once on this device. It is being fetched while you read."
          : "Choose a side."}
      </p>
    </div>
  );
}
