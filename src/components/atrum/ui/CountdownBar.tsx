import { color, motion } from "@/lib/atrum/theme";

/**
 * Thinning urgency bar for a market's `bettingCloseTime`. `LiveMarket` has no creation
 * timestamp to measure a full open-to-close window against, so this fills relative to a fixed
 * lookback horizon instead of true elapsed lifetime -- still zero new data, just a different
 * denominator. Plain CSS `width`/`background-color` transition, no Framer Motion needed --
 * already reduced-motion-safe via the global `prefers-reduced-motion` rule.
 */
const URGENCY_WINDOW_SECONDS = 6 * 3600;

export default function CountdownBar({
  closeTime,
  now,
  className,
}: {
  closeTime: number;
  now: number;
  className?: string;
}) {
  const remaining = closeTime - now;
  const remainingFrac = Math.max(0, Math.min(1, remaining / URGENCY_WINDOW_SECONDS));
  const urgent = remaining <= URGENCY_WINDOW_SECONDS * 0.1;

  return (
    <div className={className} style={{ height: 3, background: color.slate }}>
      <div
        style={{
          height: "100%",
          width: `${remainingFrac * 100}%`,
          background: urgent ? color.ember : color.smoke,
          transition: `width ${motion.panel}, background ${motion.local}`,
        }}
      />
    </div>
  );
}
