import { color, font } from "@/lib/atrum/theme";

export default function RedeemCard({ onGoNotes }: { onGoNotes: () => void }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 24 }}>
        Settlement
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
        One note of yours won.
      </div>
      <p style={{ margin: "0 0 32px", fontSize: 17, color: color.pewter }}>
        Redeeming pays into a shielded note. No money moves, and nothing about you is published. Withdrawing is a
        separate step, whenever you like — the longer the gap, the less the two look related.
      </p>
      <button
        onClick={onGoNotes}
        style={{
          width: "100%",
          padding: 24,
          border: `1px solid ${color.halo}`,
          background: "none",
          color: color.halo,
          borderRadius: 2,
          cursor: "pointer",
          fontFamily: font.display,
          fontSize: 24,
          letterSpacing: "0.16em",
        }}
      >
        REDEEM
      </button>
      <p style={{ margin: "16px 0 0", fontSize: 13, color: color.ash }}>
        Proving the redemption takes about a second and a half on this machine. Artifacts are already cached.
      </p>
    </div>
  );
}
