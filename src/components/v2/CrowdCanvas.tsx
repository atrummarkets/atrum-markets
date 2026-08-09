"use client";

import { useEffect, useRef } from "react";
import { c } from "@/lib/atrum/v2/tokens";

/**
 * Your note being mixed into the crowd, while the batch assembles.
 *
 * THIS IS THE MOST IMPORTANT ANIMATION IN THE PRODUCT. A deposit cannot be spent until it
 * joins a batch, which takes a minute or two, and today users read that silence as the site
 * being broken. It is the opposite: the wait IS the privacy being manufactured. Your note is
 * becoming indistinguishable from every other one.
 *
 * So the gold dot -- yours -- starts large, haloed and obvious, and fades toward the same grey
 * as everyone else as the batch fills. By 100% it is unfindable. That is the whole idea, drawn.
 *
 * Canvas rather than DOM: a few hundred nodes at 60fps is trivial here and pathological as
 * elements.
 */

interface Dot {
  angle: number;
  radius: number;
  phase: number;
  speed: number;
  born: number;
  settled: boolean;
  me?: boolean;
}

function makeDot(settled: boolean, now: number, me = false): Dot {
  return {
    angle: Math.random() * Math.PI * 2,
    // sqrt-ish so dots spread evenly by area rather than clustering in the middle.
    radius: Math.pow(Math.random(), 0.55),
    phase: Math.random() * Math.PI * 2,
    speed: 0.3 + Math.random() * 0.7,
    born: now,
    settled,
    me,
  };
}

export default function CrowdCanvas({
  progress,
  reducedMotion,
}: {
  /** Batch completion, 0..1. Drives how far your note has faded into the set. */
  progress: number;
  reducedMotion: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const dots = useRef<Dot[]>([]);
  const raf = useRef<number | null>(null);
  // Read inside the animation loop so progress changes never restart it -- a restart would
  // reseed the crowd and make the set visibly jump.
  const progressRef = useRef(progress);
  // Synced in an effect, not during render: the animation loop reads this every frame, so a
  // one-frame lag is invisible, and writing a ref while rendering is not allowed.
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const now = performance.now();
    dots.current = Array.from({ length: 110 }, () => makeDot(true, now));
    dots.current.push(makeDot(true, now, true));

    const draw = (t: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const pct = Math.min(1, Math.max(0, progressRef.current));
      const { width: W, height: H } = canvas;
      ctx.clearRect(0, 0, W, H);

      // The set keeps growing while the batch fills -- others are arriving too, which is
      // exactly why waiting helps you.
      if (dots.current.length < 320 && Math.random() < 0.35) {
        dots.current.push(makeDot(false, t));
      }

      const cx = W / 2;
      const cy = H / 2;
      const RX = W * 0.42;
      const RY = H * 0.4;

      for (const d of dots.current) {
        const grow = Math.min(1, (t - d.born) / 900);
        const rr = d.radius * (d.settled ? 1 : grow);
        const wobble = reducedMotion ? 0 : Math.sin((t / 1000) * d.speed + d.phase) * 0.018;
        const x = cx + Math.cos(d.angle + wobble) * rr * RX;
        const y = cy + Math.sin(d.angle * 1.3 + wobble) * rr * RY;

        if (d.me) {
          // Fades from unmistakable to identical. The halo goes first, then the colour.
          const fade = 1 - pct;
          ctx.fillStyle = `rgba(200,164,101,${0.35 + 0.65 * fade})`;
          ctx.beginPath();
          ctx.arc(x, y, 3.4 + 2.2 * fade, 0, Math.PI * 2);
          ctx.fill();
          if (fade > 0.05) {
            ctx.strokeStyle = `rgba(200,164,101,${0.5 * fade})`;
            ctx.beginPath();
            ctx.arc(x, y, 9 + 4 * Math.sin(t / 300), 0, Math.PI * 2);
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = `rgba(150,158,170,${0.28 + 0.3 * grow})`;
          ctx.beginPath();
          ctx.arc(x, y, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Closed at 100%: the set is sealed and nothing more joins this batch.
      if (pct >= 1) {
        ctx.strokeStyle = "rgba(200,164,101,0.55)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, RX + 14, RY + 14, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={ref}
      width={900}
      height={380}
      aria-hidden
      style={{ width: "100%", maxWidth: 640, height: "auto", display: "block", margin: "0 auto", background: c.void }}
    />
  );
}
