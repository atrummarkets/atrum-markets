"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * Mined from Magic UI's NumberTicker technique, rebuilt style-agnostic: counts between real
 * polled values instead of hard-cutting on each refresh. No colors or fonts baked in -- the call
 * site's `className` decides that (mono, ivory/ember, matching the surrounding figure).
 *
 * `flashOnChange` is opt-in: on top of the digit tween, it briefly overrides the text color to
 * signal direction (halo on increase, smoke on decrease) via inline `style`, which always wins
 * over the base `className` color regardless of Tailwind's utility ordering. Defaults match
 * `theme.ts`'s halo/smoke tokens without importing theme.ts, to keep this component's zero-import
 * style-agnostic contract intact.
 */
export default function NumberTicker({
  value,
  format = (n: number) => Math.round(n).toString(),
  className,
  durationMs = 600,
  flashOnChange = false,
  flashUpColor = "#F0D9B0",
  flashDownColor = "#8B94A3",
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  durationMs?: number;
  flashOnChange?: boolean;
  flashUpColor?: string;
  flashDownColor?: string;
}) {
  const [display, setDisplay] = useState(value);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const prev = useRef(value);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      prev.current = value;
      return;
    }

    const from = prev.current;
    const controls = animate(from, value, {
      duration: durationMs / 1000,
      ease: [0.65, 0, 0.35, 1],
      onUpdate: (v) => setDisplay(v),
    });

    if (flashOnChange && value !== from) {
      setFlashColor(value > from ? flashUpColor : flashDownColor);
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
      flashTimeout.current = setTimeout(() => setFlashColor(null), 260);
    }

    prev.current = value;
    return () => controls.stop();
  }, [value, durationMs, reduce, flashOnChange, flashUpColor, flashDownColor]);

  useEffect(() => {
    return () => {
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
    };
  }, []);

  return (
    <span
      className={className}
      style={{ color: flashColor ?? undefined, transition: "color 260ms cubic-bezier(0.65,0,0.35,1)" }}
    >
      {format(reduce ? value : display)}
    </span>
  );
}
