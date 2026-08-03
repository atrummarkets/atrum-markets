/**
 * Atrum product UI design tokens.
 * Ported from anonymity-set-interface-design/project/Atrum Market.dc.html
 * See ATRUM-UI-PROMPT.md for the rationale behind each decision.
 */

export const color = {
  void: "#06070A", // ground — blue-black, never pure black
  basalt: "#0D0F14", // plane 1
  graphite: "#15181F", // plane 2
  slate: "#1F242D", // rules
  iron: "#333A45", // inert
  ash: "#5A6472", // non-text UI, NO side
  smoke: "#8B94A3", // text secondary
  pewter: "#B9C0CA", // text tertiary
  bone: "#E8E4DC", // text primary
  ivory: "#F5F1E8", // highest light, YES side
  halo: "#F0D9B0", // warm light — under 1% of any surface
  champagne: "#C9A96E", // warm metal — under 1% of any surface
  ember: "#B03A24", // danger only — the refusal
  hairline: "rgba(232,228,220,0.10)",
  hairlineStrong: "rgba(232,228,220,0.30)",
} as const;

export const font = {
  wordmark: "var(--font-syne), sans-serif",
  display: "var(--font-barlow-condensed), sans-serif",
  body: "var(--font-manrope), system-ui, sans-serif",
  mono: "var(--font-geist-mono), ui-monospace, monospace",
} as const;

export const motion = {
  control: "160ms cubic-bezier(0.65,0,0.35,1)",
  local: "260ms cubic-bezier(0.65,0,0.35,1)",
  panel: "440ms cubic-bezier(0.16,1,0.30,1)",
  event: "900ms cubic-bezier(0.16,1,0.30,1)", // reserved for resolution/seal — spend rarely
} as const;

/** The floor below which the house declines the bet. Not a UI constant — a protocol rule. */
export const ANONYMITY_FLOOR = 12;
/** Notes are grafted into the tree in batches of this size. */
export const GRAFT_BATCH_SIZE = 64;
/** Every action declares the same gas, regardless of what it does. */
export const DECLARED_GAS_LIMIT = "2,500,000";
/** Fixed bet denominations. An unusual amount is a name tag. */
export const CHIP_DENOMINATIONS = [5, 25, 100, 500] as const;
