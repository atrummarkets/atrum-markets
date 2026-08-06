"use client";

import { motion } from "motion/react";

/**
 * Mined from Aceternity's "Text Generate Effect" technique (word-by-word blur-in), font and
 * color left to the caller. Used at most once per page -- the welcome headline, or a settled
 * market's outcome reveal -- so it reads as a single, deliberate beat, not a stylistic tic.
 */
export default function TextReveal({
  text,
  className,
  staggerMs = 40,
}: {
  text: string;
  className?: string;
  staggerMs?: number;
}) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, filter: "blur(6px)", y: 6 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ duration: 0.5, delay: (i * staggerMs) / 1000, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block"
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}
