import { color, font, motion } from "@/lib/atrum/theme";
import type { LiveMarket } from "@/lib/atrum/api";
import { useOddsHistory } from "@/lib/atrum/marketContext";
import { useDetailMode } from "@/lib/atrum/detailMode";
import Detail from "@/components/atrum/ui/Detail";
import Sparkline from "@/components/atrum/ui/Sparkline";
import NumberTicker from "@/components/atrum/ui/motion/NumberTicker";

export default function OddsBoard({ market }: { market: LiveMarket }) {
  const yesPct = market.oddsYesPct;
  const decided = market.settled;
  const { mode } = useDetailMode();
  const history = useOddsHistory(market.marketId);

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
          <NumberTicker
            value={yesPct}
            className="font-mono font-light leading-[0.82] text-display1 text-ivory"
            flashOnChange
          />
          <span style={{ fontFamily: font.display, fontSize: 22, letterSpacing: "0.16em", color: color.ivory }}>YES</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ fontFamily: font.display, fontSize: 22, letterSpacing: "0.16em", color: color.smoke }}>NO</span>
          <NumberTicker
            value={100 - yesPct}
            className="font-mono font-light leading-[0.82] text-display1 text-ash"
            flashOnChange
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, height: 10 }}>
        <div style={{ background: color.ivory, width: `${yesPct}%`, transition: `width ${motion.panel}` }} />
        <div style={{ background: color.iron, flex: 1 }} />
      </div>

      {mode === "detailed" && (
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <Sparkline points={history.map((h) => h.pct)} />
          <span className="text-[11px] text-ash">Since you opened this page</span>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Detail summary={decided ? "How this was published" : "Why this number isn't exact"}>
          <p style={{ margin: 0, fontSize: 15, color: color.smoke, maxWidth: "62ch" }}>
            {decided
              ? "These are the decrypted totals, published on chain with a proof that they match the ciphertext the market accumulated."
              : "Individual stakes are encrypted on chain. This ratio is the pool total decrypted for display — in production it is published coarsely and on a cadence, because a precise live ratio lets an observer solve backwards for a single stake."}
          </p>
        </Detail>
      </div>
    </div>
  );
}
