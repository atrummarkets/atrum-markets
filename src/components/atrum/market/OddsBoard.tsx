import { color, font, motion } from "@/lib/atrum/theme";

export default function OddsBoard({
  resolved,
  yesPct,
}: {
  resolved: boolean;
  yesPct: number;
}) {
  const noPct = 100 - yesPct;

  return (
    <div style={{ paddingBottom: 64, borderBottom: `1px solid ${color.hairline}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 32 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>
          {resolved ? "Final ratio" : "Published odds"}
        </div>
        <div style={{ fontFamily: font.mono, fontSize: 13, color: color.ash }}>
          {resolved ? "sealed at resolution" : "last republish 00:14:22 ago"}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 32, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <span style={{ fontFamily: font.mono, fontWeight: 300, fontSize: "clamp(48px,8vw,112px)", lineHeight: 0.82, color: color.ivory }}>
            {yesPct}
          </span>
          <span style={{ fontFamily: font.display, fontSize: 24, letterSpacing: "0.16em", color: color.ivory }}>YES</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <span style={{ fontFamily: font.display, fontSize: 24, letterSpacing: "0.16em", color: color.smoke }}>NO</span>
          <span style={{ fontFamily: font.mono, fontWeight: 300, fontSize: "clamp(48px,8vw,112px)", lineHeight: 0.82, color: color.ash }}>
            {noPct}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, height: 12 }}>
        <div style={{ background: color.ivory, width: `${yesPct}%`, transition: `width ${motion.panel}` }} />
        <div style={{ background: color.iron, flex: 1 }} />
      </div>
      <p style={{ margin: "24px 0 0", fontSize: 15, color: color.smoke, maxWidth: "62ch" }}>
        The ratio moves in whole percent and republishes after several bets land. Finer, faster odds would let an
        observer solve backwards for a single stake. Coarse is the point.
      </p>
    </div>
  );
}
