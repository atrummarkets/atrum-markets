import type { CSSProperties } from "react";
import type { Tick } from "@/lib/atrum/ticks";

export default function TickBar({
  ticks,
  height,
  gap = 2,
  grow = false,
  transition,
}: {
  ticks: Tick[];
  height: number;
  gap?: number;
  /** Bars stretch to fill the row (anonymity panel) vs. fixed width (header). */
  grow?: boolean;
  transition?: string;
}) {
  const barStyle = (t: Tick): CSSProperties => ({
    flex: grow ? 1 : undefined,
    width: grow ? undefined : 2,
    height: t.height,
    background: t.color,
    transition,
  });

  return (
    <div style={{ display: "flex", gap, alignItems: "flex-end", height }}>
      {ticks.map((t, i) => (
        <div key={i} style={barStyle(t)} />
      ))}
    </div>
  );
}
