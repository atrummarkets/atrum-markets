"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Mined from Magic UI's AnimatedList technique. Used only for `/privacy/[noteId]`'s trace, where
 * each item is a real stage that actually happened to that note -- the stagger reinforces "step
 * by step," it isn't decorative motion on content that was already fully loaded.
 */
export default function AnimatedList<T>({
  items,
  renderItem,
  keyExtractor,
  className,
  style,
  staggerMs = 90,
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  className?: string;
  style?: React.CSSProperties;
  staggerMs?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={className} style={style}>
      {items.map((item, i) => {
        const stagger = Math.min(i, 8);
        return (
          <motion.div
            key={keyExtractor(item, i)}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: reduce ? 0 : (stagger * staggerMs) / 1000, ease: [0.16, 1, 0.3, 1] }}
          >
            {renderItem(item, i)}
          </motion.div>
        );
      })}
    </div>
  );
}
