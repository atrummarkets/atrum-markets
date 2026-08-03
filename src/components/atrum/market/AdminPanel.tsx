"use client";

import { useState } from "react";
import { color, font } from "@/lib/atrum/theme";
import { doResolve, doSettle, type LiveMarket } from "@/lib/atrum/api";
import { useMarket } from "@/lib/atrum/marketContext";
import { txUrl, shortHash } from "@/lib/atrum/format";

/**
 * Operator controls for a manually-resolved market.
 *
 * Shown only once the market is actually resolvable, and labelled for what it is: these
 * markets name an EOA as `Vault.resolver`, so a person decides the outcome. Production markets
 * point `resolver` at `PythResolver`, where the outcome is a comparison against a signed price
 * and no address can decide it. Hiding this panel would not make the market trustless; saying
 * so is the honest option.
 */
export default function AdminPanel({ market }: { market: LiveMarket }) {
  const { refresh } = useMarket();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; hash?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const now = Math.floor(Date.now() / 1000);
  const resolvable = market.phase === "closed" && now >= market.resolutionStartTime;
  const settleable = market.phase === "resolved";
  if (!resolvable && !settleable) return null;

  async function act(what: string, fn: () => Promise<{ txHash: string }>) {
    setBusy(what);
    setErr(null);
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ text: `${what} done`, hash: r.txHash || undefined });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const button = (labelText: string, onClick: () => void, accent: string = color.hairlineStrong) => (
    <button
      onClick={onClick}
      disabled={busy !== null}
      style={{
        padding: "12px 20px",
        border: `1px solid ${accent}`,
        background: "none",
        color: busy ? color.ash : color.bone,
        borderRadius: 2,
        cursor: busy ? "wait" : "pointer",
        fontSize: 13,
        letterSpacing: "0.04em",
      }}
    >
      {busy === labelText ? "Working…" : labelText}
    </button>
  );

  return (
    <div style={{ marginTop: 56, border: `1px dashed ${color.slate}`, padding: 28 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 10 }}>
        Operator · manual resolver
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: color.smoke, maxWidth: "70ch" }}>
        This market names an address as its resolver, so a person decides the outcome and it is visible here
        rather than hidden. Oracle-resolved markets replace this with a signed price comparison that nobody can
        override.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {resolvable && button("Resolve YES", () => act("Resolve YES", () => doResolve(market.marketId, "YES")))}
        {resolvable && button("Resolve NO", () => act("Resolve NO", () => doResolve(market.marketId, "NO")))}
        {settleable &&
          button("Settle (decrypt + publish totals)", () => act("Settle", () => doSettle(market.marketId)), color.halo)}
      </div>

      {msg && (
        <p style={{ margin: "16px 0 0", fontSize: 13, color: color.pewter }}>
          {msg.text}
          {msg.hash && (
            <>
              {" · "}
              <a href={txUrl(msg.hash)} target="_blank" rel="noreferrer" style={{ fontFamily: font.mono, color: color.halo }}>
                {shortHash(msg.hash)}
              </a>
            </>
          )}
        </p>
      )}
      {err && <p style={{ margin: "16px 0 0", fontSize: 13, color: color.ember }}>{err}</p>}
    </div>
  );
}
