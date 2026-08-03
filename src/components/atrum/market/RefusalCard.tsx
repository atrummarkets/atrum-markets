import { color, font, ANONYMITY_FLOOR } from "@/lib/atrum/theme";
import { refusalTicks } from "@/lib/atrum/ticks";
import TickBar from "../TickBar";

/** The refusal is the soul of the product. Calm, certain, explanatory — never a red error banner. */
export default function RefusalCard({ anonymitySet, onGoBoundary }: { anonymitySet: number; onGoBoundary: () => void }) {
  const shortBy = Math.max(0, ANONYMITY_FLOOR - anonymitySet);

  return (
    <div style={{ animation: "atrum-rise 440ms cubic-bezier(0.16,1,0.30,1)" }}>
      <div style={{ height: 1, background: color.ember, marginBottom: 32 }} />
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ember, marginBottom: 32 }}>
        The house declines
      </div>
      <div
        style={{
          fontFamily: font.display,
          fontSize: "clamp(28px,3.4vw,42px)",
          lineHeight: 1.02,
          letterSpacing: "0.02em",
          color: color.ivory,
          marginBottom: 24,
        }}
      >
        The room is too empty.
      </div>
      <p style={{ margin: "0 0 32px", fontSize: 17, color: color.pewter }}>
        Only <span style={{ fontFamily: font.mono, color: color.ivory }}>{String(anonymitySet).padStart(2, "0")}</span>{" "}
        notes look like yours. Your proof would be flawless and you would still be identifiable — there is nobody
        here to be mistaken for. We would rather turn you away than let you believe otherwise.
      </p>

      <div style={{ marginBottom: 8 }}>
        <TickBar ticks={refusalTicks(anonymitySet)} height={24} grow />
      </div>
      <div style={{ fontFamily: font.mono, fontSize: 13, color: color.ash, marginBottom: 32 }}>
        {shortBy} more notes and the floor is met
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={onGoBoundary}
          style={{
            padding: 20,
            border: `1px solid ${color.hairlineStrong}`,
            background: "none",
            color: color.bone,
            borderRadius: 2,
            cursor: "pointer",
            fontSize: 15,
            textAlign: "left",
          }}
        >
          Deposit now — join the next graft, bet after
        </button>
        <button
          onClick={onGoBoundary}
          style={{
            padding: 20,
            border: `1px solid ${color.hairline}`,
            background: "none",
            color: color.pewter,
            borderRadius: 2,
            cursor: "pointer",
            fontSize: 15,
            textAlign: "left",
          }}
        >
          Watch the set — tell me at twelve
        </button>
      </div>
      <p style={{ margin: "32px 0 0", fontSize: 13, color: color.ash }}>
        The set grows when others deposit. Sets are typically largest in the hours after a graft.
      </p>
    </div>
  );
}
