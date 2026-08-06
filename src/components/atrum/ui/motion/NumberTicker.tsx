"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";

/**
 * Mined from Magic UI's NumberTicker technique, rebuilt style-agnostic: counts between real
 * polled values instead of hard-cutting on each refresh. No colors or fonts baked in -- the call
 * site's `className` decides that (mono, ivory/ember, matching the surrounding figure).
 */
export default function NumberTicker({
  value,
  format = (n: number) => Math.round(n).toString(),
  className,
  durationMs = 600,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: durationMs / 1000,
      ease: [0.65, 0, 0.35, 1],
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
