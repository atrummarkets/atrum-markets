"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { color, ANONYMITY_FLOOR, CHIP_DENOMINATIONS } from "./theme";
import type { MarketSnapshot, Note, ProvingStep, SealStage, Side } from "./types";

/**
 * Mock protocol state. Replace with real reads once the sequencer /
 * contracts are wired in — the shape (MarketSnapshot) is the seam.
 */
const MOCK_MARKET: MarketSnapshot = {
  question: "Will Monad mainnet clear 10,000 TPS sustained before 1 October?",
  marketId: "0x7A41·9C",
  phase: "open",
  outcome: "YES",
  oddsYesPct: 63,
  pool: "184,250 MON",
  closesInSeconds: 214173,
  resolvedAt: "02 Aug · 14:22 UTC",
};

/** Stand-in for "how many other notes exist right now" — live in reality. */
const ANONYMITY_SET_BASE = 47;

const TOTAL_CONSTRAINTS = 1_048_576;

/** Measured prove times, see ATRUM-UI-PROMPT.md. Artifacts download once per device, not per action. */
const PROOF_STEP_ARTIFACTS: ProvingStep = {
  label: "Artifacts",
  detail: "bet.zkey · 11.8 MB. One download per device, cached in IndexedDB. Never per action.",
  ms: 3400,
};
const PROOF_STEPS_REST: ProvingStep[] = [
  { label: "Witness", detail: "Built in a Web Worker. The main thread stays yours.", ms: 520 },
  {
    label: "Proof",
    detail: "Groth16 over the commitment tree. 2,255 ms in Node; a browser is slower, a phone slower again.",
    ms: 2900,
  },
  {
    label: "Relay",
    detail: "A relayer submits it. Your address never touches the chain; the relayer knows it was you.",
    ms: 1100,
  },
];

const BASE_NOTES: Note[] = [
  {
    id: "0x91C4·7F",
    state: "COLLATERAL",
    detail: "Grafted eleven minutes ago. Free to bet.",
    amount: "100 MON",
    action: "Bet",
    actionable: true,
    stateColor: color.pewter,
    actionColor: color.bone,
    actionBorder: color.hairlineStrong,
  },
  {
    id: "0x2E08·3B",
    state: "QUEUED",
    detail: "Waiting for the next graft. Forty-one notes ahead.",
    amount: "100 MON",
    action: "Waiting",
    actionable: false,
    stateColor: color.ash,
    actionColor: color.ash,
    actionBorder: color.hairline,
  },
  {
    id: "0x77A1·D9",
    state: "YES · OPEN",
    detail: "Sealed. Nothing about it is published until settlement.",
    amount: "500 MON",
    action: "Sealed",
    actionable: false,
    stateColor: color.ivory,
    actionColor: color.ash,
    actionBorder: color.hairline,
  },
  {
    id: "0x4BD3·1C",
    state: "NO · RESOLVED",
    detail: "The market resolved YES. This note is spent.",
    amount: "25 MON",
    action: "Spent",
    actionable: false,
    stateColor: color.smoke,
    actionColor: color.ash,
    actionBorder: color.hairline,
  },
  {
    id: "0x0F55·82",
    state: "WON · UNREDEEMED",
    detail: "Redeeming pays into a shielded note. No money moves.",
    amount: "100 MON",
    action: "Redeem",
    actionable: true,
    stateColor: color.halo,
    actionColor: color.halo,
    actionBorder: color.halo,
  },
  {
    id: "0xA320·6E",
    state: "SETTLED",
    detail: "Redeemed. Withdraw whenever you like — later is quieter.",
    amount: "100 MON",
    action: "Withdraw",
    actionable: true,
    stateColor: color.pewter,
    actionColor: color.bone,
    actionBorder: color.hairlineStrong,
  },
];

interface State {
  side: Side | null;
  denom: number;
  stage: SealStage;
  step: number;
  elapsedMs: number;
  constraintsSatisfied: number;
  drift: number;
  secondsToClose: number;
  cached: boolean;
  sealedNoteId: string | null;
}

interface MarketContextValue extends State {
  market: MarketSnapshot;
  anonymitySet: number;
  anonymityOk: boolean;
  notes: Note[];
  provingSteps: ProvingStep[];
  pickSide: (side: Side) => void;
  pickDenom: (denom: number) => void;
  seal: () => void;
  reset: () => void;
}

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({
    side: null,
    denom: CHIP_DENOMINATIONS[2],
    stage: "idle",
    step: -1,
    elapsedMs: 0,
    constraintsSatisfied: 0,
    drift: 0,
    secondsToClose: MOCK_MARKET.closesInSeconds,
    cached: false,
    sealedNoteId: null,
  });
  const [sealedNotes, setSealedNotes] = useState<Note[]>([]);
  const proofTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const provingSteps = useMemo<ProvingStep[]>(
    () => (state.cached ? PROOF_STEPS_REST : [PROOF_STEP_ARTIFACTS, ...PROOF_STEPS_REST]),
    [state.cached],
  );

  const anonymitySet = Math.max(0, ANONYMITY_SET_BASE + state.drift);
  const anonymityOk = anonymitySet >= ANONYMITY_FLOOR;

  // Countdown to close. Mock — comes from the market's on-chain deadline in reality.
  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => ({ ...s, secondsToClose: Math.max(0, s.secondsToClose - 1) }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Simulates the anonymity set growing as other users deposit. Replace with a live subscription.
  useEffect(() => {
    const id = setInterval(() => {
      if (Math.random() < 0.5) setState((s) => ({ ...s, drift: s.drift + 1 }));
    }, 9000);
    return () => clearInterval(id);
  }, []);

  const pickSide = useCallback((side: Side) => {
    setState((s) => (s.stage === "idle" ? { ...s, side } : s));
  }, []);

  const pickDenom = useCallback((denom: number) => {
    setState((s) => (s.stage === "idle" ? { ...s, denom } : s));
  }, []);

  const seal = useCallback(() => {
    setState((s) => {
      if (s.side === null || anonymitySet < ANONYMITY_FLOOR || s.stage !== "idle") return s;
      return { ...s, stage: "proving", step: 0, elapsedMs: 0, constraintsSatisfied: 0 };
    });
  }, [anonymitySet]);

  const reset = useCallback(() => {
    setState((s) => ({ ...s, stage: "idle", side: null }));
  }, []);

  // Drives the fake proving pipeline: this is where a real prover (Web Worker + relayer
  // submission) replaces setTimeout/setInterval, keeping the same stage/step/elapsed contract.
  useEffect(() => {
    if (state.stage !== "proving") return;

    const defs = provingSteps;
    const side = state.side;
    const denom = state.denom;
    const t0 = Date.now();
    const proofIndex = defs.length - 2;
    const proofStart = defs.slice(0, proofIndex).reduce((a, x) => a + x.ms, 0);
    const proofMs = defs[proofIndex].ms;

    proofTimer.current = setInterval(() => {
      const elapsed = Date.now() - t0;
      const frac = Math.max(0, Math.min(1, (elapsed - proofStart) / proofMs));
      setState((s) => ({ ...s, elapsedMs: elapsed, constraintsSatisfied: Math.round(TOTAL_CONSTRAINTS * frac) }));
    }, 47);

    let acc = 0;
    const stepTimers = defs.map((step, i) => {
      acc += step.ms;
      return setTimeout(() => {
        if (i === defs.length - 1) {
          if (proofTimer.current) clearInterval(proofTimer.current);
          const id =
            "0x" + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0") + "·A1";
          setState((s) => ({
            ...s,
            stage: "sealed",
            step: -1,
            cached: true,
            constraintsSatisfied: TOTAL_CONSTRAINTS,
            sealedNoteId: id,
          }));
          setSealedNotes((prev) => [
            {
              id,
              state: (side === "yes" ? "YES" : "NO") + " · OPEN",
              detail: "Sealed a moment ago. Relayed by 0x4C·D2.",
              amount: denom + " MON",
              action: "Sealed",
              actionable: false,
              stateColor: side === "yes" ? color.ivory : color.smoke,
              actionColor: color.ash,
              actionBorder: color.hairline,
            },
            ...prev,
          ]);
        } else {
          setState((s) => ({ ...s, step: i + 1 }));
        }
      }, acc);
    });

    return () => {
      stepTimers.forEach(clearTimeout);
      if (proofTimer.current) clearInterval(proofTimer.current);
    };
    // provingSteps/state.side/state.denom are read once, at the moment sealing starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage]);

  const notes = useMemo(() => [...sealedNotes, ...BASE_NOTES], [sealedNotes]);

  const value: MarketContextValue = {
    ...state,
    market: MOCK_MARKET,
    anonymitySet,
    anonymityOk,
    notes,
    provingSteps,
    pickSide,
    pickDenom,
    seal,
    reset,
  };

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketContextValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used within a MarketProvider");
  return ctx;
}
