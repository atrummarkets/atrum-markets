import { color, font, motion } from "@/lib/atrum/theme";
import type { PoolState } from "@/lib/atrum/api";

const BATCH_SIZE = 64;

export default function AnonymityPanel({ pool }: { pool: PoolState }) {
  const ok = pool.anonymityOk;
  // One tick per note up to the batch width. Real counts, no padding.
  const ticks = Array.from({ length: BATCH_SIZE }, (_, i) => i < pool.totalDeposits);

  return (
    <div style={{ marginTop: 56, background: color.basalt, border: `1px solid ${color.hairline}`, padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 40, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 20 }}>
            Anonymity set
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <span
              style={{
                fontFamily: font.mono,
                fontWeight: 300,
                fontSize: "clamp(44px,7vw,96px)",
                lineHeight: 0.82,
                color: ok ? color.ivory : color.ember,
                transition: `color ${motion.panel}`,
              }}
            >
              {String(pool.totalDeposits).padStart(2, "0")}
            </span>
            <span style={{ fontSize: 18, color: color.pewter, maxWidth: "18ch" }}>notes in the shared pool</span>
          </div>
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>Floor</div>
          <div style={{ fontFamily: font.mono, fontSize: 22, color: color.smoke }}>{pool.minAnonymitySet}</div>
          <div style={{ fontSize: 13, color: color.ash, maxWidth: "24ch" }}>
            Below this the pool refuses the bet.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 40, marginTop: 40 }}>
        {ticks.map((filled, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: filled ? 40 : i === pool.minAnonymitySet - 1 ? 16 : 8,
              background: filled ? (ok ? color.ivory : color.ember) : i === pool.minAnonymitySet - 1 ? color.ash : color.slate,
              transition: `height ${motion.panel}, background ${motion.panel}`,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: font.mono, fontSize: 13, color: color.iron }}>
        <span>0</span>
        <span style={{ color: color.ash }}>{pool.minAnonymitySet} · floor</span>
        <span>{BATCH_SIZE} · batch</span>
      </div>

      <p style={{ margin: "28px 0 0", fontSize: 16, color: color.smoke, maxWidth: "70ch" }}>
        A proof gives you a hiding place; only the crowd gives you someone to hide behind. Notes enter the tree in
        batches of {BATCH_SIZE}, and a deposit names no market — so every unspent note in the system is part of
        the set, not just this market&apos;s.
      </p>
    </div>
  );
}
