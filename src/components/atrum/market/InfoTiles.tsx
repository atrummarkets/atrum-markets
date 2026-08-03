import { color, font, DECLARED_GAS_LIMIT } from "@/lib/atrum/theme";

const TILES = [
  {
    title: "The relayer",
    body: "A relayer submits your transaction, so your address never touches the chain. It knows the transaction was yours. The trust is relocated, not removed.",
  },
  {
    title: "The fee",
    body: (
      <>
        Every action declares{" "}
        <span style={{ fontFamily: font.mono, color: color.pewter }}>{DECLARED_GAS_LIMIT}</span> gas. The limit is
        public, so one limit for all actions is the only limit that names none of them. You pay the same for
        everything.
      </>
    ),
  },
  {
    title: "The payout",
    body: "Redeeming pays into a shielded note; no money moves and nothing is published. Withdrawing is a separate, public step, taken whenever you like.",
  },
];

export default function InfoTiles() {
  return (
    <div
      style={{
        marginTop: 64,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
        gap: 1,
        background: color.hairline,
        border: `1px solid ${color.hairline}`,
      }}
    >
      {TILES.map((tile) => (
        <div key={tile.title} style={{ background: color.void, padding: 32 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash, marginBottom: 16 }}>
            {tile.title}
          </div>
          <p style={{ margin: 0, fontSize: 15, color: color.smoke }}>{tile.body}</p>
        </div>
      ))}
    </div>
  );
}
