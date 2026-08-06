"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Ported from Magic UI's Animated Beam technique: an SVG path between two DOM nodes, with a
 * small pulse traveling along it via native SVG `animateMotion` rather than a Framer Motion
 * animation loop -- one less thing ticking on the page for a beam that's only ever visible once
 * a `Detail` panel is expanded. Skips drawing entirely if the two nodes aren't roughly on the
 * same row (the grid it connects wraps to a stacked layout on narrow viewports, where a
 * left-to-right beam would just be a stray diagonal line across unrelated content).
 *
 * Used to connect the relayer/proof/payout explainer tiles left-to-right, reinforcing the
 * sequence rather than decorating it -- same justification standard as `AnimatedList`/
 * `TextReveal`: the motion has to mean something, not just move.
 */
export default function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  fromRef: React.RefObject<HTMLElement | null>;
  toRef: React.RefObject<HTMLElement | null>;
}) {
  const [path, setPath] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    function update() {
      const container = containerRef.current;
      const from = fromRef.current;
      const to = toRef.current;
      if (!container || !from || !to) {
        setPath(null);
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const fromRect = from.getBoundingClientRect();
      const toRect = to.getBoundingClientRect();
      const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
      const y2 = toRect.top + toRect.height / 2 - containerRect.top;

      if (Math.abs(y1 - y2) > 40) {
        setPath(null);
        return;
      }

      setPath({
        x1: fromRect.right - containerRect.left,
        y1,
        x2: toRect.left - containerRect.left,
        y2,
      });
    }

    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerRef, fromRef, toRef]);

  if (!path) return null;

  const d = `M ${path.x1} ${path.y1} L ${path.x2} ${path.y2}`;

  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      <path d={d} stroke="#F0D9B0" strokeOpacity={0.25} strokeWidth={1} fill="none" />
      {!reduce && (
        <circle r={3} fill="#F0D9B0">
          <animateMotion dur="2.4s" repeatCount="indefinite" path={d} />
        </circle>
      )}
    </svg>
  );
}
