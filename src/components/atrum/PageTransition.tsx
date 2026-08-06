"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * Cross-fades between routes inside `(product)/layout.tsx`. Scoped to just `{children}` --
 * `Header`, `Footer`, `ActivityOverlay`, and `ReceiptOverlay` sit outside this wrapper in the
 * layout, so nav and overlays never flicker on navigation. `MarketProvider`/`WalletProvider`
 * wrap the layout above this, holding live-polled state in context rather than refetching per
 * route, so `mode="wait"` doesn't introduce a loading gap between `/markets` and `/market/[id]`.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? undefined : { opacity: 0, y: -8 }}
        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
