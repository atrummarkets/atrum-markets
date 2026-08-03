import { color, font, motion } from "@/lib/atrum/theme";
import type { LiveMarket } from "@/lib/atrum/api";

export default function OddsBoard({ market }: { market: LiveMarket }) {
  const yesPct = market.oddsYesPct;
  const decided = market.settled;

  return (
    <div style={{ paddingBottom: 48, borderBottom: `1px solid ${color.hairline}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>
          {decided ? "Final ratio" : "Implied odds"}
        </div>
        <div style={{ fontFamily: font.mono, fontSize: 13, color: color.ash }}>
          {decided
            ? `settled · YES ${market.yesUnits} / NO ${market.noUnits}`
            : `${market.yesUnits + market.noUnits} units staked`}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 32, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ fontFamily: font.mono, fontWeight: 300, fontSize: "clamp(44px,7vw,96px)", lineHeight: 0.82, color: color.ivory }}>
            {yesPct}
          </span>
          <span style={{ fontFamily: font.display, fontSize: 22, letterSpacing: "0.16em", color: color.ivory }}>YES</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ fontFamily: font.display, fontSize: 22, letterSpacing: "0.16em", color: color.smoke }}>NO</span>
          <span style={{ fontFamily: font.mono, fontWeight: 300, fontSize: "clamp(44px,7vw,96px)", lineHeight: 0.82, color: color.ash }}>
            {100 - yesPct}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, height: 10 }}>
        <div style={{ background: color.ivory, width: `${yesPct}%`, transition: `width ${motion.panel}` }} />
        <div style={{ background: color.iron, flex: 1 }} />
      </div>

      <p style={{ margin: "20px 0 0", fontSize: 15, color: color.smoke, maxWidth: "62ch" }}>
        {decided
          ? "These are the decrypted totals, published on chain with a proof that they match the ciphertext the market accumulated."
          : "Individual stakes are encrypted on chain. This ratio is the pool total decrypted for display — in production it is published coarsely and on a cadence, because a precise live ratio lets an observer solve backwards for a single stake."}
      </p>
    </div>
  );
}
