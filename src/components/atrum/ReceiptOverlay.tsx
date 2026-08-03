"use client";

import { useRouter } from "next/navigation";
import { color, font } from "@/lib/atrum/theme";
import { formatElapsed, formatGas, shortHash, shortAddress, txUrl, addressUrl } from "@/lib/atrum/format";
import { useMarket } from "@/lib/atrum/marketContext";

const TITLE = {
  deposit: "Deposited",
  bet: "Sealed",
  redeem: "Redeemed",
  withdraw: "Withdrawn",
} as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "14px 0", borderBottom: `1px solid ${color.hairline}` }}>
      <span style={{ fontSize: 15, color: color.smoke }}>{label}</span>
      <span style={{ fontFamily: font.mono, fontSize: 14, color: color.bone, textAlign: "right" }}>{children}</span>
    </div>
  );
}

export default function ReceiptOverlay() {
  const { receipt, dismissReceipt } = useMarket();
  const router = useRouter();
  if (!receipt) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: color.void,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 64,
      }}
    >
      <div style={{ width: "100%", maxWidth: 620, animation: "atrum-rise 400ms cubic-bezier(0.16,1,0.30,1)" }}>
        <div style={{ height: 1, background: color.halo, transformOrigin: "left", animation: "atrum-aperture 900ms cubic-bezier(0.16,1,0.30,1)", marginBottom: 28 }} />
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.halo, marginBottom: 24 }}>
          {TITLE[receipt.kind]}
        </div>

        {receipt.detail && (
          <div style={{ fontFamily: font.display, fontSize: "clamp(28px,4vw,44px)", lineHeight: 1.08, color: color.ivory, marginBottom: 32 }}>
            {receipt.detail}
          </div>
        )}

        <div style={{ borderTop: `1px solid ${color.hairline}` }}>
          <Row label="Transaction">
            <a href={txUrl(receipt.txHash)} target="_blank" rel="noreferrer" style={{ color: color.halo, textDecoration: "none" }}>
              {shortHash(receipt.txHash)} ↗
            </a>
          </Row>
          {receipt.relayer ? (
            <Row label="Submitted by">
              <a href={addressUrl(receipt.relayer)} target="_blank" rel="noreferrer" style={{ color: color.pewter, textDecoration: "none" }}>
                relayer {shortAddress(receipt.relayer)} ↗
              </a>
            </Row>
          ) : (
            <Row label="Submitted by">your wallet</Row>
          )}
          {receipt.gasUsed && <Row label="Gas used">{formatGas(receipt.gasUsed)}</Row>}
          {receipt.provingMs !== undefined && <Row label="Proving time">{formatElapsed(receipt.provingMs)}</Row>}
          {receipt.noteId && <Row label="New note">0x{receipt.noteId}</Row>}
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
              router.push("/notes");
            }}
            style={{ flex: 1, padding: 18, border: 0, background: color.ivory, color: color.void, borderRadius: 2, cursor: "pointer", fontSize: 15 }}
          >
            View notes
          </button>
        </div>
      </div>
    </div>
  );
}
