"use client";

import { color, font, motion } from "@/lib/atrum/theme";
import { useDetailMode } from "@/lib/atrum/detailMode";
import type { PoolState } from "@/lib/atrum/api";
import Detail from "@/components/atrum/ui/Detail";
import NumberTicker from "@/components/atrum/ui/motion/NumberTicker";

const BATCH_SIZE = 64;

export default function AnonymityPanel({ pool }: { pool: PoolState }) {
  const { mode } = useDetailMode();
  const ok = pool.anonymityOk;
  // One tick per note up to the batch width. Real counts, no padding.
  const ticks = Array.from({ length: BATCH_SIZE }, (_, i) => i < pool.totalDeposits);
  const others = Math.max(pool.totalDeposits - 1, 0);

  return (
    <div style={{ marginTop: 56, background: color.basalt, border: `1px solid ${color.hairline}`, padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 40, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 20 }}>
            {mode === "detailed" ? "Anonymity set" : "Privacy pool"}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <NumberTicker
              value={pool.totalDeposits}
              format={(n) => String(Math.round(n)).padStart(2, "0")}
              className={`font-mono font-light leading-[0.82] text-[clamp(44px,7vw,96px)] ${ok ? "text-ivory" : "text-ember"}`}
              durationMs={700}
            />
            <span style={{ fontSize: 18, color: color.pewter, maxWidth: "20ch" }}>
              {mode === "detailed" ? "notes in the shared pool" : `${others} other position${others === 1 ? "" : "s"} mixed with yours`}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>Floor</div>
          <div style={{ fontFamily: font.mono, fontSize: 22, color: color.smoke }}>{pool.minAnonymitySet}</div>
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

      <div style={{ marginTop: 28 }}>
        <Detail summary={mode === "detailed" ? "Why the crowd matters" : "How this works"}>
          <p style={{ margin: 0, fontSize: 16, color: color.smoke, maxWidth: "70ch" }}>
            A proof gives you a hiding place; only the crowd gives you someone to hide behind. Notes enter the tree
            in batches of {BATCH_SIZE}, and a deposit names no market — so every unspent note in the system is
            part of the set, not just this market&apos;s. Below the floor of {pool.minAnonymitySet}, the pool
            refuses to bet at all.
          </p>
        </Detail>
      </div>
    </div>
  );
}
