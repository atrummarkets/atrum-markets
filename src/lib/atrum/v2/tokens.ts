/**
 * The v2 design system, taken from the Claude Design prototype.
 *
 * Values are lifted verbatim from `atrum-privacy-betting-ui-flow` rather than re-derived, so
 * the built product matches the mock exactly. The existing `theme.ts` palette stays untouched:
 * v1 screens still render from it, and having one file quietly redefine the other's colours is
 * how two designs become one muddled one.
 */

export const c = {
  /** Page. Near-black, not black -- true black makes the gold read as neon. */
  void: "#0B0C0E",
  /** Raised panels: tickets, note cards, the two threshold cards. */
  panel: "#111317",
  /** Panel on hover, and the flash a market row gets when its odds move. */
  panelLit: "#14161A",
  panelFlash: "#161920",
  /** Inset wells -- inputs, the deposit door frame. */
  well: "#0B0C0E",
  sealPanel: "#0E1013",
  doorFace: "#15181D",

  text: "#E7E9EC",
  /** Secondary copy. Everything explanatory sits here, not in `text`. */
  dim: "#8A919C",
  /** Metadata, units, captions. */
  faint: "#5A616C",
  /** Inactive step labels in the flow rail. */
  ghost: "#3A404A",
  footer: "#454B54",
  bright: "#B9BFC8",

  /** Atrum gold. Privacy, sealing, the user's own note in the crowd. */
  gold: "#C8A465",
  goldLit: "#E0C084",
  /** YES. */
  green: "#3DBE8B",
  /** NO. */
  red: "#D0705F",
} as const;

/** Hairlines. Borders are never solid colours -- they are light on near-black. */
export const line = {
  faint: "rgba(255,255,255,0.06)",
  soft: "rgba(255,255,255,0.07)",
  base: "rgba(255,255,255,0.09)",
  strong: "rgba(255,255,255,0.12)",
  hover: "rgba(255,255,255,0.18)",
  gold: "rgba(200,164,101,0.4)",
  goldSoft: "rgba(200,164,101,0.25)",
  goldStrong: "rgba(200,164,101,0.5)",
  green: "rgba(61,190,139,0.45)",
  red: "rgba(208,112,95,0.6)",
} as const;

/** Tinted fills, always over the near-black ground. */
export const fill = {
  gold: "rgba(200,164,101,0.12)",
  goldFaint: "rgba(200,164,101,0.05)",
  goldLit: "rgba(200,164,101,0.25)",
  green: "rgba(61,190,139,0.12)",
  red: "rgba(208,112,95,0.12)",
  redTrack: "rgba(208,112,95,0.28)",
} as const;

/**
 * Loaded via next/font in the root layout, referenced here through their CSS variables so the
 * self-hosted files are used rather than a system fallback that merely shares the name.
 */
export const font = {
  sans: "var(--font-instrument-sans), system-ui, sans-serif",
  mono: "var(--font-ibm-plex-mono), ui-monospace, monospace",
} as const;

/**
 * Note states, and what each permits.
 *
 * Deliberately the vocabulary a trader would use, not the protocol's. `outcome === 3` becomes
 * READY; a live position becomes POSITION · SEALED. Protocol mode reveals the real terms
 * underneath rather than replacing these.
 */
export const noteState = {
  pending: { label: "PENDING", color: c.dim, bg: "rgba(138,145,156,0.1)", border: line.base },
  ready: { label: "READY", color: c.gold, bg: fill.goldFaint, border: "rgba(200,164,101,0.3)" },
  position: { label: "POSITION · SEALED", color: c.bright, bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.1)" },
  won: { label: "WON", color: c.green, bg: "rgba(61,190,139,0.1)", border: "rgba(61,190,139,0.35)" },
  lost: { label: "LOST", color: c.faint, bg: "rgba(138,145,156,0.06)", border: line.soft },
  spent: { label: "SPENT", color: c.faint, bg: "rgba(138,145,156,0.06)", border: line.soft },
} as const;

export type NoteStateKey = keyof typeof noteState;

/** The five steps of a first bet, in order. */
export const FLOW_STEPS = ["deposit", "batching", "proving", "sealing", "receipt"] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];
export const FLOW_LABELS: Record<FlowStep, string> = {
  deposit: "DEPOSIT",
  batching: "BATCH",
  proving: "PROVE",
  sealing: "SEAL",
  receipt: "RECEIPT",
};

/**
 * Withdrawal ladder, mirroring `Denominations.sol`.
 *
 * Powers of ten only -- NOT 1-2-5. Privacy rests on withdrawals looking identical, so the set
 * is deliberately coarse. The prototype offered a 25 chip; 25 is not a denomination and the
 * contract would reject it, so the chips here are the real rungs.
 */
export const DENOMINATIONS = [1, 10, 100, 1000] as const;

/** Greedy breakdown into rungs, largest first -- what `withdraw` actually has to do. */
export function breakdown(amount: number): number[] {
  const out: number[] = [];
  let rest = amount;
  for (const d of [...DENOMINATIONS].reverse()) {
    while (rest >= d) {
      out.push(d);
      rest -= d;
    }
  }
  return out;
}

/** "3×100 + 2×10" -- how a withdrawal reads once it is chunked. */
export function chunkSummary(list: number[]): string {
  const by: Record<number, number> = {};
  for (const chunk of list) by[chunk] = (by[chunk] ?? 0) + 1;
  return Object.keys(by)
    .map(Number)
    .sort((a, b) => b - a)
    .map((k) => `${by[k]}×${k}`)
    .join(" + ");
}
