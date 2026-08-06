"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { color, font } from "@/lib/atrum/theme";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import type { LiveNote } from "@/lib/atrum/api";
import { Dialog, AtrumDialogContent } from "@/components/atrum/ui/Dialog";
import { DialogTitle } from "@/components/ui/dialog";
import PillButton from "@/components/atrum/ui/PillButton";
import StatRow from "@/components/atrum/ui/StatRow";
import ShineButton from "@/components/atrum/ui/motion/ShineButton";

/** Powers of ten, matching `Denominations.sol`. The public leg must be a rung. */
function rungsUpTo(units: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= units; d *= 10) out.push(d);
  return out;
}

export default function WithdrawDialog({ note, onClose }: { note: LiveNote; onClose: () => void }) {
  const { withdraw, activity, error, clearError } = useMarket();
  const { address } = useWallet();

  const units = Number(note.units);
  const rungs = rungsUpTo(units);
  const [amount, setAmount] = useState<number | null>(rungs.length ? rungs[rungs.length - 1] : null);
  const [recipient, setRecipient] = useState<string>(address ?? "");

  const change = amount === null ? 0 : units - amount;
  const valid = amount !== null && /^0x[a-fA-F0-9]{40}$/.test(recipient.trim()) && !activity;

  return (
    <Dialog open modal onOpenChange={(open) => !open && onClose()}>
      <AtrumDialogContent
        aria-describedby={undefined}
        className="p-8"
        onEscapeKeyDown={onClose}
        overlayClassName="bg-void/85"
      >
        <DialogTitle className="sr-only">Send to your wallet</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.65, 0, 0.35, 1] }}
          style={{ width: "100%", maxWidth: 560, background: color.basalt, border: `1px solid ${color.hairlineStrong}`, padding: 40, borderRadius: 2 }}
        >
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 20 }}>
            Send · public
          </div>
          <div style={{ fontFamily: font.display, fontSize: 34, lineHeight: 1.05, color: color.ivory, marginBottom: 20 }}>
            Leave the pool.
          </div>
          <p style={{ margin: "0 0 28px", fontSize: 16, color: color.pewter }}>
            The amount and the recipient are public — real collateral moves. Which note funded it stays hidden.
            Sending to a fresh address you have never used keeps it that way.
          </p>

          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 12 }}>
            Amount · fixed denominations only
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {rungs.map((r) => (
              <PillButton key={r} selected={amount === r} onClick={() => setAmount(r)} className="px-5 py-3">
                {r}
              </PillButton>
            ))}
          </div>
          <div style={{ marginBottom: 8 }}>
            <StatRow label="Note holds">{units} units</StatRow>
            {change > 0 && <StatRow label="Change back">{change} units (private)</StatRow>}
          </div>
          <p style={{ margin: "0 0 24px", fontSize: 13, color: color.ash }}>
            A rung nobody else has used would name you, so the pool refuses those.
          </p>

          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 12 }}>
            Recipient
          </div>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            style={{ width: "100%", padding: "14px 16px", border: `1px solid ${color.hairline}`, background: "transparent", color: color.bone, borderRadius: 2, fontFamily: font.mono, fontSize: 14, marginBottom: 8 }}
          />
          <p style={{ margin: "0 0 28px", fontSize: 13, color: color.ash }}>
            Defaults to your connected wallet, which links this exit to you. A fresh address does not — and the
            relayer sends it a little MON so it can transact.
          </p>

          {error && (
            <div style={{ marginBottom: 20, fontSize: 13, color: color.ember }}>
              {error}{" "}
              <button onClick={clearError} style={{ background: "none", border: 0, color: color.ash, cursor: "pointer", textDecoration: "underline", fontSize: 13 }}>
                dismiss
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <PillButton
              selected={false}
              onClick={onClose}
              unselectedClassName="flex-1 bg-transparent text-pewter border-hairline"
              className="justify-center py-[18px] text-[15px]"
            >
              Cancel
            </PillButton>
            <PillButton
              selected={valid}
              disabled={!valid}
              onClick={async () => {
                if (!valid || amount === null) return;
                await withdraw(note.id, amount, recipient.trim());
                onClose();
              }}
              className="relative flex-[2] justify-center overflow-hidden py-[18px] font-display text-[18px] tracking-[0.14em]"
            >
              <ShineButton active={valid} />
              SEND
            </PillButton>
          </div>
        </motion.div>
      </AtrumDialogContent>
    </Dialog>
  );
}
