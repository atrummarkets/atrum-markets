"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMarket } from "@/lib/atrum/marketContext";
import type { FlowStep } from "./tokens";

/**
 * Drives the flow overlay from what the protocol is actually doing.
 *
 * NOT A TIMELINE. Every field here traces to a real signal: the step comes from
 * `activity.phase`, which the actions stamp as they cross into downloading / proving /
 * relaying / wallet / confirming; the batch figures come from the pool; the receipt is the
 * transaction that landed. Nothing advances because time passed.
 *
 * THE BATCH STEP OUTLIVES THE ACTION. `deposit()` resolves when the transaction confirms, but
 * the note is not spendable until the sequencer grafts it into a batch -- typically a minute or
 * two later. v1 dropped the user back onto a screen where their new note simply did not work
 * yet. Here the overlay stays up and watches `status: "queued" -> "grafted"` on the actual note,
 * so the wait is explained rather than encountered.
 */

/** The sequencer grafts in batches of this size; it also grafts on a timer when short. */
const BATCH_SIZE = 64;

/**
 * Cap on assembly shown before the note is genuinely grafted.
 *
 * The queue can sit at 64/64 for a moment before the graft transaction lands, and showing 100%
 * while the note is still unspendable is the one lie this screen must not tell.
 */
const ASSEMBLING_CAP = 0.95;

export interface FlowState {
  kind: "deposit" | "bet";
  step: FlowStep;
  steps: readonly FlowStep[];
  batchProgress: number;
  anonymitySet: number | null;
  /** Artifact download, when one is in flight. Absent once the circuit is cached. */
  download?: { loaded: number; total: number };
  /** Purely for the lattice animation — never rendered as a measured quantity. */
  proveProgress: number;
  proveLabel: string;
  /** Real wall-clock since the action began. */
  elapsedMs: number;
  /** Constraint count of the circuit this run actually proves. Read from config, not typed in. */
  constraints: number | null;
  sealPlaintext: string;
  receipt?: { txHash: string; relayer?: string; provingMs?: number };
  error?: string;
}

type Kind = "deposit" | "bet";

interface Run {
  kind: Kind;
  seal: string;
  startedAt: number;
  /** Set once a deposit lands, so the batch watch knows which note to follow. */
  noteId?: string;
  /** True once the run is over and the receipt panel is showing. */
  finished: boolean;
}

const DEPOSIT_STEPS: readonly FlowStep[] = ["proving", "deposit", "batching", "receipt"];
const BET_STEPS: readonly FlowStep[] = ["proving", "sealing", "receipt"];

export function useFlow() {
  const { activity, receipt, pool, notes, error, config, dismissReceipt, clearError } = useMarket();
  const [run, setRun] = useState<Run | null>(null);
  const [now, setNow] = useState(0);
  const runRef = useRef<Run | null>(null);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  /** Open the overlay for an action that is about to start. */
  const begin = useCallback(
    (kind: Kind, seal: string) => {
      clearError();
      const next: Run = { kind, seal, startedAt: Date.now(), finished: false };
      runRef.current = next;
      setRun(next);
      // Seeded from the run's own start, so the elapsed clock never has to read the wall clock
      // during render.
      setNow(next.startedAt);
    },
    [clearError],
  );

  const close = useCallback(() => {
    runRef.current = null;
    setRun(null);
    dismissReceipt();
  }, [dismissReceipt]);

  // A ticking clock, only while something is open. Elapsed time is the one honest number
  // available during the proof itself -- snarkjs reports no intermediate progress.
  useEffect(() => {
    if (!run || run.finished) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [run]);

  // The action finished: capture its receipt. For a bet that ends the run; for a deposit the
  // note still has to be grafted, so the overlay moves to the batch watch instead.
  useEffect(() => {
    const r = runRef.current;
    if (!r || r.finished || !receipt) return;
    if (r.kind === "bet" && receipt.kind !== "bet") return;
    if (r.kind === "deposit" && receipt.kind !== "deposit") return;
    setRun((prev) => (prev ? { ...prev, noteId: receipt.noteId, finished: r.kind === "bet" } : prev));
  }, [receipt]);

  // Deposit only: watch the real note until the sequencer has grafted it.
  const watched = run?.kind === "deposit" && run.noteId ? notes.find((n) => n.id === run.noteId) : undefined;
  const grafted = watched?.status === "grafted" || watched?.status === "spent";

  useEffect(() => {
    if (!grafted) return;
    // Deferred a tick: a synchronous setState in an effect body forces an extra render pass
    // before paint, and this one lands mid-animation on the batch canvas.
    const id = setTimeout(() => setRun((prev) => (prev && !prev.finished ? { ...prev, finished: true } : prev)), 0);
    return () => clearTimeout(id);
  }, [grafted]);

  const state: FlowState | null = useMemo(() => {
    if (!run) return null;

    const elapsedMs = Math.max(0, now - run.startedAt);
    const steps = run.kind === "deposit" ? DEPOSIT_STEPS : BET_STEPS;
    const anonymitySet = pool?.totalDeposits ?? null;

    // Real queue depth, capped short of complete until the note is provably grafted.
    const batchProgress = grafted
      ? 1
      : Math.min(ASSEMBLING_CAP, (pool?.queuedCount ?? 0) / BATCH_SIZE);

    const base = {
      kind: run.kind,
      steps,
      batchProgress,
      anonymitySet,
      elapsedMs,
      sealPlaintext: run.seal,
      proveProgress: 0,
      proveLabel: "",
      constraints: config?.circuits[run.kind]?.constraints ?? null,
    };

    if (error) return { ...base, step: "receipt" as FlowStep, error };

    if (run.finished) {
      return {
        ...base,
        step: "receipt" as FlowStep,
        receipt: receipt
          ? { txHash: receipt.txHash, relayer: receipt.relayer, provingMs: receipt.provingMs }
          : undefined,
      };
    }

    // The action is over and we are waiting on the sequencer, not on the user.
    if (run.kind === "deposit" && run.noteId) {
      return { ...base, step: "batching" as FlowStep };
    }

    const phase = activity?.phase;
    const download = activity?.download;

    if (phase === "wallet" || phase === "confirming") {
      return { ...base, step: "deposit" as FlowStep, proveLabel: activity?.step ?? "" };
    }

    if (phase === "relaying") {
      // For a bet this is the moment the ciphertext exists and is leaving without an address on
      // it, which is exactly what the seal panel is about.
      return run.kind === "bet"
        ? { ...base, step: "sealing" as FlowStep, proveLabel: "RELAYING" }
        : { ...base, step: "deposit" as FlowStep, proveLabel: "RELAYING" };
    }

    // Downloading gives a real fraction; proving gives none, so the lattice is driven by elapsed
    // time and clearly labelled as an animation rather than a measurement.
    const proveProgress = download
      ? download.total
        ? download.loaded / download.total
        : 0
      : Math.min(0.97, elapsedMs / 12000);

    return {
      ...base,
      step: "proving" as FlowStep,
      download,
      proveProgress,
      proveLabel: download ? "FETCHING CIRCUIT" : "PROVING LOCALLY",
    };
  }, [run, now, pool, grafted, error, receipt, activity, config]);

  return { state, begin, close };
}
