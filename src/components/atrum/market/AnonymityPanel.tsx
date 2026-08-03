import { color, font, motion, ANONYMITY_FLOOR, GRAFT_BATCH_SIZE } from "@/lib/atrum/theme";
import { setTicks } from "@/lib/atrum/ticks";
import TickBar from "../TickBar";

/** The soul of the product: a live count of how many people you could be mistaken for. */
export default function AnonymityPanel({ anonymitySet, ok }: { anonymitySet: number; ok: boolean }) {
  return (
    <div style={{ marginTop: 64, background: color.basalt, border: `1px solid ${color.hairline}`, padding: 48 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 48, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 24 }}>
            Anonymity set
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <span
              style={{
                fontFamily: font.mono,
                fontWeight: 300,
                fontSize: "clamp(48px,8vw,112px)",
                lineHeight: 0.82,
                color: ok ? color.ivory : color.ember,
                transition: `color ${motion.panel}`,
              }}
            >
              {String(anonymitySet).padStart(2, "0")}
            </span>
            <span style={{ fontSize: 20, color: color.pewter, maxWidth: "18ch" }}>notes look like yours right now</span>
          </div>
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>Floor</div>
          <div style={{ fontFamily: font.mono, fontSize: 24, color: color.smoke }}>{ANONYMITY_FLOOR}</div>
          <div style={{ fontSize: 13, color: color.ash, maxWidth: "22ch" }}>Below this the house declines the bet.</div>
        </div>
      </div>

      <div style={{ marginTop: 48 }}>
        <TickBar
          ticks={setTicks(anonymitySet, ok)}
          height={40}
          grow
          transition={`height ${motion.panel}, background ${motion.panel}`}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: font.mono, fontSize: 13, color: color.iron }}>
        <span>0</span>
        <span style={{ color: color.ash }}>{ANONYMITY_FLOOR} · floor</span>
        <span>{GRAFT_BATCH_SIZE} · batch</span>
      </div>

      <p style={{ margin: "32px 0 0", fontSize: 17, color: color.smoke, maxWidth: "70ch" }}>
        The cryptography is perfect and it protects nothing on its own. A proof gives you a hiding place; only the
        crowd gives you someone to hide behind. This is the count of people you could be mistaken for.
      </p>
    </div>
  );
}
