"use client";

import { font } from "@/lib/atrum/theme";
import { poolMarqueeItems } from "@/lib/atrum/format";
import { useMarket } from "@/lib/atrum/marketContext";
import Marquee from "@/components/atrum/ui/motion/Marquee";

/**
 * Global scrolling strip above the sidebar, on every product page -- supersedes the marquee
 * `/markets` used to render locally (same `poolMarqueeItems`, now shared via format.ts so the
 * two never drift). Fixed full-width, sits above `Sidebar` in the stacking order.
 */
export default function HeaderTicker() {
  const { pool } = useMarket();
  if (!pool) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-30 h-8 border-b border-hairline bg-void">
      <Marquee
        items={poolMarqueeItems(pool).map((t) => (
          <span key={t} style={{ fontFamily: font.mono, fontSize: 12 }} className="text-ash">
            {t}
          </span>
        ))}
        className="flex h-8 items-center px-4"
      />
    </div>
  );
}
