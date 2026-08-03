"use client";

import { useRouter } from "next/navigation";
import { color, font } from "@/lib/atrum/theme";
import { formatElapsed } from "@/lib/atrum/format";
import { useMarket } from "@/lib/atrum/marketContext";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: `1px solid ${color.hairline}` }}>
      <span style={{ fontSize: 15, color: color.smoke }}>{label}</span>
      <span style={{ fontFamily: font.mono, fontSize: 15, color: color.bone }}>{value}</span>
    </div>
  );
}

export default function SealedOverlay() {
  const { stage, side, denom, elapsedMs, sealedNoteId, reset } = useMarket();
  const router = useRouter();
  if (stage !== "sealed") return null;

  const headline = `${side === "yes" ? "YES" : "NO"} · ${denom} MON`;

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
      <div style={{ width: "100%", maxWidth: 640, animation: "atrum-rise 440ms cubic-bezier(0.16,1,0.30,1)" }}>
        <div
          style={{
            height: 1,
            background: color.halo,
            transformOrigin: "left",
            animation: "atrum-aperture 900ms cubic-bezier(0.16,1,0.30,1)",
            marginBottom: 32,
          }}
        />
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.halo, marginBottom: 32 }}>
          Sealed
        </div>
        <div
          style={{
            fontFamily: font.display,
            fontSize: "clamp(38px,5.4vw,68px)",
            lineHeight: 0.98,
            letterSpacing: "0.02em",
            color: color.ivory,
            marginBottom: 32,
          }}
        >
          {headline}
        </div>

        <div style={{ borderTop: `1px solid ${color.hairline}` }}>
          <Row label="Note" value={sealedNoteId ?? ""} />
          <Row label="Submitted by" value="relayer 0x4C·D2" />
          <Row label="Proof time" value={formatElapsed(elapsedMs)} />
        </div>

        <p style={{ margin: "32px 0 0", fontSize: 17, color: color.smoke }}>
          Your stake is not published. The odds will move when the next batch republishes them, and nothing in
          that movement is attributable to you. The relayer knows you sent it.
        </p>

        <div style={{ display: "flex", gap: 8, marginTop: 48 }}>
          <button
            onClick={reset}
            style={{
              flex: 1,
              padding: 20,
              border: `1px solid ${color.hairlineStrong}`,
              background: "none",
              color: color.bone,
              borderRadius: 2,
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            Back to the room
          </button>
          <button
            onClick={() => {
              reset();
              router.push("/notes");
            }}
            style={{
              flex: 1,
              padding: 20,
              border: 0,
              background: color.ivory,
              color: color.void,
              borderRadius: 2,
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            View notes
          </button>
        </div>
      </div>
    </div>
  );
}
