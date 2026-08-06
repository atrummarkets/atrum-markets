/**
 * Atrum product UI design tokens.
 * Ported from anonymity-set-interface-design/project/Atrum Market.dc.html
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

/**
 * Named by use-case, not by pixel size -- pick `display1` for "big numeral reveal," not for
 * "whatever's ~90px." Collapses what were five near-duplicate ad hoc H1 `clamp()`s and a dozen
 * one-off body sizes into a scale every new component should pull from instead of eyeballing.
 */
export const type = {
  display1: "clamp(44px,7vw,96px)", // big numeral reveals: odds, resolution outcome, anonymity count
  display2: "clamp(32px,4vw,56px)", // page H1s
  display3: "26px", // card/section titles
  bodyLg: "19px", // page intros
  body: "16px",
  bodySm: "13px",
  label: "11px", // the uppercase-tracked chip Label.tsx already standardizes
} as const;

/** The de facto standard already repeated across 6+ pages, named instead of retyped. */
export const space = {
  pageX: 64,
  pageYTop: 80,
  pageYBottom: 128,
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
  32: 128,
} as const;

/**
 * The anonymity floor and the denomination ladder are NOT UI constants -- they are on-chain
 * protocol values (`ShieldedPool.minAnonymitySet`, `Denominations.sol`) that differ per
 * deployment. They are read live from /api/atrum/config; hardcoding them here is how the UI
 * ends up confidently stating a number the contract disagrees with.
 */
