"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Mined from Magic UI's Marquee technique. The only place this is used (`/markets`) ticks real,
 * anonymized pool events -- "note grafted", "batch sealed" -- never a specific bet, side, or
 * amount. Activity-as-trust-signal, not a logo strip.
 */
export default function Marquee({
  items,
  className,
  durationMs = 22000,
}: {
  items: React.ReactNode[];
  className?: string;
  durationMs?: number;
}) {
  if (items.length === 0) return null;
  return (
    <div className={cn("overflow-hidden", className)}>
      <motion.div
        className="flex w-max items-center gap-12"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: durationMs / 1000, repeat: Infinity, ease: "linear" }}
      >
        {[...items, ...items].map((item, i) => (
          <span key={i} className="whitespace-nowrap">
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
