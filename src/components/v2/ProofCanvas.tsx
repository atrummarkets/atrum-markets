"use client";

import { useEffect, useRef } from "react";

/**
 * The proof assembling itself, while it actually assembles.
 *
 * For a couple of seconds the browser is doing the mathematics that makes a bet unlinkable to
 * a person. Most products would show a spinner over that. This draws a Merkle lattice building
 * from leaves to root, so the wait shows the product working rather than apologising for it.
 *
 * REPRESENTATIVE, NOT LITERAL. It is a 6-level, 63-node lattice, not the real depth-20 tree,
 * and node k appearing does not mean constraint k was synthesised. It is paced by real
 * progress and stops when proving really stops; it is a visualisation of the shape of the
 * work, and the caption beside it says what is actually happening.
 */

interface Node {
  level: number;
  index: number;
  x: number;
  y: number;
}

/** Nodes ordered leaves-first, so drawing the first N is always a valid partial tree. */
function buildTree(): Node[] {
  const nodes: Node[] = [];
  for (let level = 0; level < 6; level++) {
    const count = 32 >> level;
    for (let index = 0; index < count; index++) {
      nodes.push({ level, index, x: (index + 0.5) / count, y: 0.92 - level * 0.165 });
    }
  }
  return nodes;
}

/** Level k starts at these offsets in the flat array; a node's parent is at start[k+1] + i/2. */
const LEVEL_STARTS = [0, 32, 48, 56, 60, 62];
const TOTAL_NODES = 63;

export default function ProofCanvas({ progress }: { progress: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const tree = useRef<Node[]>(buildTree());
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const t = Math.min(1, Math.max(0, progressRef.current));
      const { width: W, height: H } = canvas;
      ctx.clearRect(0, 0, W, H);

      const pad = 60;
      const px = (n: Node) => pad + n.x * (W - pad * 2);
      const py = (n: Node) => n.y * H;
      // Eased so the lattice surges early and settles, which reads as work rather than a bar.
      const eased = 1 - Math.pow(1 - t, 3);
      const visible = Math.floor(eased * TOTAL_NODES);

      for (let k = 0; k < TOTAL_NODES; k++) {
        const n = tree.current[k];
        if (k >= visible && t < 1) continue;

        if (n.level < 5) {
          const parentIdx = LEVEL_STARTS[n.level + 1] + (n.index >> 1);
          const parent = tree.current[parentIdx];
          ctx.strokeStyle = `rgba(200,164,101,${parentIdx < visible || t >= 1 ? 0.35 : 0.1})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px(n), py(n));
          ctx.lineTo(px(parent), py(parent));
          ctx.stroke();
        }

        // The newest few burn white, so the eye follows the frontier of the computation.
        const isNew = k >= visible - 3 && t < 1;
        ctx.fillStyle = isNew
          ? "rgba(231,233,236,0.95)"
          : `rgba(200,164,101,${0.45 + 0.4 * (n.level / 5)})`;
        const s = 2.5 + n.level * 1.1;
        ctx.fillRect(px(n) - s / 2, py(n) - s / 2, s, s);
      }

      // The root, ringed once the proof is complete.
      if (t >= 1) {
        const top = tree.current[TOTAL_NODES - 1];
        ctx.strokeStyle = "rgba(231,233,236,0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px(top), py(top), 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      width={900}
      height={360}
      aria-hidden
      style={{ width: "100%", maxWidth: 640, height: "auto", display: "block", margin: "0 auto" }}
    />
  );
}
