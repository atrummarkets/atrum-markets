export type Side = "yes" | "no";

export type SealStage = "idle" | "proving" | "sealed";

export type NoteState =
  | "COLLATERAL"
  | "QUEUED"
  | "OPEN"
  | "RESOLVED"
  | "WON_UNREDEEMED"
  | "SETTLED";

export interface Note {
  id: string;
  state: string; // display label, e.g. "YES · OPEN"
  detail: string;
  amount: string;
  action: string;
  actionable: boolean;
  stateColor: string;
  actionColor: string;
  actionBorder: string;
}

export interface ProvingStep {
  label: string;
  detail: string;
  ms: number;
}

export type MarketPhase = "open" | "resolved";

/**
 * Everything below this line is mock/local data standing in for real
 * on-chain + circuit state. Swap the provider's data sources (not its
 * shape) when the sequencer, contracts, and prover are wired in.
 */
export interface MarketSnapshot {
  question: string;
  marketId: string;
  phase: MarketPhase;
  outcome: "YES" | "NO";
  oddsYesPct: number;
  pool: string;
  closesInSeconds: number;
  resolvedAt: string;
}
