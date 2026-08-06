"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import { color, font } from "@/lib/atrum/theme";
import { formatElapsed, formatGas, shortHash, shortAddress, txUrl, addressUrl } from "@/lib/atrum/format";
import { useMarket } from "@/lib/atrum/marketContext";
import { Dialog, AtrumDialogContent } from "@/components/atrum/ui/Dialog";
import { DialogTitle } from "@/components/ui/dialog";
import StatRow from "@/components/atrum/ui/StatRow";

const TITLE = {
  deposit: "Deposited",
  bet: "Sealed",
  redeem: "Redeemed",
  withdraw: "Withdrawn",
} as const;

export default function ReceiptOverlay() {
  const { receipt, dismissReceipt } = useMarket();
  const router = useRouter();
  const firedFor = useRef<string | null>(null);

  // Claiming a resolved winning position -- the one celebratory beat in the app. Guarded by
  // txHash so it fires once per receipt, not on every re-render while the dialog is open.
  useEffect(() => {
    if (!receipt || receipt.kind !== "redeem") return;
    if (firedFor.current === receipt.txHash) return;
    firedFor.current = receipt.txHash;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    confetti({
      particleCount: 40,
      spread: 60,
      startVelocity: 28,
      origin: { y: 0.3 },
      colors: [color.halo, color.champagne, color.ivory],
      disableForReducedMotion: true,
    });
  }, [receipt]);

  return (
    <AnimatePresence>
      {receipt && (
        <Dialog open modal onOpenChange={(open) => !open && dismissReceipt()}>
          <AtrumDialogContent aria-describedby={undefined}>
            <DialogTitle className="sr-only">{TITLE[receipt.kind]}</DialogTitle>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[620px]"
            >
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: 1, background: color.halo, transformOrigin: "left", marginBottom: 28 }}
              />
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.halo, marginBottom: 24 }}>
                {TITLE[receipt.kind]}
              </div>

              {receipt.detail && (
                <div style={{ fontFamily: font.display, fontSize: "clamp(28px,4vw,44px)", lineHeight: 1.08, color: color.ivory, marginBottom: 32 }}>
                  {receipt.detail}
                </div>
              )}

              <div style={{ borderTop: `1px solid ${color.hairline}` }}>
                <StatRow label="Transaction">
                  <a href={txUrl(receipt.txHash)} target="_blank" rel="noreferrer" style={{ color: color.halo, textDecoration: "none" }}>
                    {shortHash(receipt.txHash)} ↗
                  </a>
                </StatRow>
                {receipt.relayer ? (
                  <StatRow label="Submitted by">
                    <a href={addressUrl(receipt.relayer)} target="_blank" rel="noreferrer" style={{ color: color.pewter, textDecoration: "none" }}>
                      relayer {shortAddress(receipt.relayer)} ↗
                    </a>
                  </StatRow>
                ) : (
                  <StatRow label="Submitted by">your wallet</StatRow>
                )}
                {receipt.gasUsed && <StatRow label="Gas used">{formatGas(receipt.gasUsed)}</StatRow>}
                {receipt.provingMs !== undefined && <StatRow label="Proving time">{formatElapsed(receipt.provingMs)}</StatRow>}
                {receipt.noteId && <StatRow label="New note">0x{receipt.noteId}</StatRow>}
              </div>

              <p style={{ margin: "28px 0 0", fontSize: 16, color: color.smoke }}>
                {receipt.relayer
                  ? "A relayer sent this, so your address is not on the transaction. The relayer knows it was you — trust is relocated, not removed."
                  : "Deposits are public by design: the pool pulls collateral from your address, so this one is signed by you."}
              </p>

              <div style={{ display: "flex", gap: 8, marginTop: 40 }}>
                <button
                  onClick={dismissReceipt}
                  style={{ flex: 1, padding: 18, border: `1px solid ${color.hairlineStrong}`, background: "none", color: color.bone, borderRadius: 2, cursor: "pointer", fontSize: 15 }}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    dismissReceipt();
                    router.push("/portfolio");
                  }}
                  style={{ flex: 1, padding: 18, border: 0, background: color.ivory, color: color.void, borderRadius: 2, cursor: "pointer", fontSize: 15 }}
                >
                  View portfolio
                </button>
              </div>
            </motion.div>
          </AtrumDialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
