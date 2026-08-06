"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Mined from Aceternity's Spotlight technique, but it's really just the same radial gradient
 * `page.tsx`/`ActivityOverlay` already use for their background, animated instead of static.
 * Halo stays under the "1% of any surface" ceiling `theme.ts` sets for that color -- this only
 * breathes, it never brightens into a highlight.
 */
export default function Spotlight({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage:
          "radial-gradient(120% 62% at 50% -18%, rgba(240,217,176,0.055) 0%, rgba(240,217,176,0.014) 34%, rgba(6,7,10,0) 66%)",
        opacity: reduce ? 0.9 : undefined,
      }}
      animate={reduce ? undefined : { opacity: [0.85, 1, 0.85] }}
      transition={reduce ? undefined : { duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
