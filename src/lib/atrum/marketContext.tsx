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
import { parseAbi } from "viem";
import { useWallet } from "./wallet";
import {
  fetchConfig,
  fetchMarkets,
  fetchMarket,
  fetchNotes,
  prepareDeposit,
  confirmDeposit,
  doBet,
  doRedeem,
  doWithdraw,
  type AppConfig,
  type LiveMarket,
  type LiveNote,
  type PoolState,
  type RelayedResult,
} from "./api";
import { useVault } from "./client/useVault";
import * as clientActions from "./client/actions";
import type { FetchProgress } from "./client/artifacts";

const POLL_MS = 5000;
/** ~5 min of session-local odds history at the current poll rate -- not fetched, not persisted,
 * gone on refresh. Honest labeling of this (see Sparkline.tsx) matters: it is the actually-
 * observed record of this browser tab's session, never a stand-in for real price history. */
const ODDS_HISTORY_CAP = 60;

/**
 * Whether this build proves in the browser.
 *
 * A build-time constant, not a runtime toggle: the two paths store notes in different places
 * (Postgres rows with secrets vs. an encrypted vault), and letting a single deployment flip
 * between them at runtime would strand notes in whichever store was not being read. Flipping
 * it is a deploy, deliberately.
 *
 * The server-side path is left fully intact behind this flag rather than deleted. It is what
 * every live note on the current deployment was created with, and deleting the only code that
 * can spend them would burn real testnet positions.
 */
const CLIENT_PROVING = process.env.NEXT_PUBLIC_CLIENT_PROVING === "1";

const DEPOSIT_ABI = parseAbi([
  "function deposit(uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256 commitment, uint256 units)",
]);
const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256)",
]);

/** What a multi-step, wallet-signed action is currently doing. Real steps, not a fake timer. */
export type ActivityKind = "deposit" | "bet" | "redeem" | "withdraw";
export interface Activity {
  kind: ActivityKind;
  step: string;
  startedAt: number;
  noteId?: string;
  /**
   * Artifact download progress, present only while a client-side proof is fetching its
   * circuit. `bet_encrypted` is 11.8MB on first use, which is long enough that a step label
   * with no number reads as a hang.
   */
  download?: { loaded: number; total: number };
}

export interface Receipt {
  kind: ActivityKind;
  txHash: string;
  /** Present only for relayed actions -- a deposit is sent by the user's own wallet. */
  relayer?: string;
  gasUsed?: string;
  provingMs?: number;
  noteId?: string;
  /** The note this action consumed, when it's known client-side (bet/redeem/withdraw all take
   * the spent note's id as an argument) -- lets `/privacy/[noteId]` show "this note was later
   * spent by ..." for a note whose own creation this session never saw. */
  spentNoteId?: string;
  detail?: string;
  /**
   * `pool.totalDeposits` at the moment this action fired, captured live -- not backfilled
   * later. There is no way to truthfully state the anonymity set size for an old action after
   * the fact (only the current count is ever readable from chain), so this is stamped here or
   * not shown at all. Powers `/privacy/[noteId]`'s "N others were in the set" line.
   */
  anonymitySetAtTime: number | null;
}

interface Value {
  config: AppConfig | null;
  markets: LiveMarket[];
  pool: PoolState | null;
  notes: LiveNote[];
  activity: Activity | null;
  receipt: Receipt | null;
  /** Every receipt this session produced, oldest first -- `ReceiptOverlay`'s content made
   * permanent and revisitable instead of one-shot. Powers `/privacy/[noteId]`. */
  receiptHistory: Receipt[];
  error: string | null;
  /** Collateral balance of the connected wallet, in units (not raw token amount). */
  walletUnits: number | null;
  /** Session-local odds history for one market, oldest first -- see ODDS_HISTORY_CAP. */
  getOddsHistory: (marketId: number) => { t: number; pct: number }[];
  /** True when this build proves in the browser and never sends the server a note secret. */
  clientProving: boolean;
  /** Whether the note vault has been unlocked this session. Meaningless unless `clientProving`. */
  vaultUnlocked: boolean;
  refresh: () => void;
  dismissReceipt: () => void;
  clearError: () => void;
  deposit: (units: number) => Promise<void>;
  faucet: (units: number) => Promise<void>;
  bet: (noteId: string, marketId: number, side: "yes" | "no") => Promise<void>;
  redeem: (noteId: string) => Promise<void>;
  withdraw: (noteId: string, amount: number, recipient: string) => Promise<void>;
}

const Ctx = createContext<Value | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const { session, address, walletClient, publicClient, signMessage } = useWallet();

  const [config, setConfig] = useState<AppConfig | null>(null);
  const [markets, setMarkets] = useState<LiveMarket[]>([]);
  const [pool, setPool] = useState<PoolState | null>(null);
  const [notes, setNotes] = useState<LiveNote[]>([]);
  const [walletUnits, setWalletUnits] = useState<number | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [receiptHistory, setReceiptHistory] = useState<Receipt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const poolRef = useRef<PoolState | null>(null);
  const oddsHistoryRef = useRef<Map<number, { t: number; pct: number }[]>>(new Map());

  const vault = useVault(
    CLIENT_PROVING ? signMessage : null,
    config?.committeePubKey ?? null,
    session,
  );

  // Under client proving the vault IS the note store, and `useVault` already re-renders on
  // change. Derived rather than mirrored into `notes` state: copying it across in an effect
  // would add a render pass and a second source of truth for the same list.
  const exposedNotes: LiveNote[] = CLIENT_PROVING ? (vault.notes as LiveNote[]) : notes;

  const refresh = useCallback(() => {
    fetchMarkets()
      .then((d) => {
        setMarkets(d.markets);
        setPool(d.pool);
        const t = Date.now();
        for (const m of d.markets) {
          const prev = oddsHistoryRef.current.get(m.marketId) ?? [];
          oddsHistoryRef.current.set(m.marketId, [...prev, { t, pct: m.oddsYesPct }].slice(-ODDS_HISTORY_CAP));
        }
      })
      .catch(() => {});

    if (CLIENT_PROVING) {
      // Nothing to poll until the vault is unlocked -- and unlocking is a wallet prompt, so it
      // must never be triggered by a background timer.
      vault.refresh().catch(() => {});
      return;
    }

    if (!session) {
      // Genuinely nobody signed in -- there are no notes to show.
      setNotes([]);
      return;
    }
    // A failed poll must NOT blank the list. Notes are the user's money; showing an empty
    // table because one request timed out reads as "everything is gone". Keep the last
    // known-good list and try again on the next tick.
    fetchNotes()
      .then((d) => setNotes(d.notes))
      .catch(() => {});
    // `vault.refresh` is stable across renders (useCallback on a ref-held vault), so it does
    // not belong in the dep array -- including it would re-create the poll interval whenever
    // the note list changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    fetchConfig().then(setConfig).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);

  /** Stamps the live anonymity-set size at the moment of the action, then both shows it (the
   * transient receipt) and keeps it (the permanent history `/privacy/[noteId]` reads). */
  const pushReceipt = useCallback((r: Omit<Receipt, "anonymitySetAtTime">) => {
    const full: Receipt = { ...r, anonymitySetAtTime: poolRef.current?.totalDeposits ?? null };
    setReceipt(full);
    setReceiptHistory((prev) => [...prev, full]);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // The connected wallet's collateral balance, so the deposit form can say plainly whether
  // there is anything to deposit rather than failing at the transaction.
  useEffect(() => {
    if (!address || !config) {
      setWalletUnits(null);
      return;
    }
    let cancelled = false;
    const read = () =>
      publicClient
        .readContract({ address: config.collateral, abi: ERC20_ABI, functionName: "balanceOf", args: [address] })
        .then((raw) => {
          if (!cancelled) setWalletUnits(Number((raw as bigint) / BigInt(config.poolState.denomination)));
        })
        .catch(() => {});
    read();
    const id = setInterval(read, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, config, publicClient]);

  /** Serialises actions: two in flight at once race the same notes and the same nonce. */
  async function run<T>(kind: ActivityKind, noteId: string | undefined, fn: (step: (s: string) => void) => Promise<T>) {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setActivity({ kind, step: "Starting", startedAt: Date.now(), noteId });
    try {
      await fn((step) => setActivity((a) => (a ? { ...a, step } : a)));
    } catch (e) {
      const msg = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message;
      setError(msg?.includes("User rejected") || msg?.includes("4001") ? "Rejected in your wallet." : msg);
    } finally {
      busy.current = false;
      setActivity(null);
      refresh();
    }
  }

  /**
   * Turns worker/download callbacks into the same `step` text the server path used, so the
   * activity overlay needs no knowledge of which prover ran.
   */
  function proveOptions(step: (s: string) => void, what: string) {
    return {
      onProgress: (p: FetchProgress) => {
        if (p.cached) return;
        setActivity((a) => (a ? { ...a, download: { loaded: p.loaded, total: p.total } } : a));
        const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0;
        step(`Downloading the ${what} circuit (${pct}%) — cached after this`);
      },
      onProvingStart: () => {
        setActivity((a) => (a ? { ...a, download: undefined } : a));
        step(`Proving ${what} in your browser`);
      },
    };
  }

  const faucet = useCallback(
    async (units: number) =>
      run("deposit", undefined, async (step) => {
        if (!config) throw new Error("config not loaded");
        if (!address) throw new Error("connect your wallet first");
        step(`Minting ${units} test ${config.token.symbol}`);
        const raw = BigInt(units) * BigInt(config.poolState.denomination);
        const hash = await (await walletClient()).writeContract({
          address: config.collateral,
          abi: ERC20_ABI,
          functionName: "mint",
          args: [address, raw],
          chain: null,
          account: address,
        });
        step("Waiting for confirmation");
        await publicClient.waitForTransactionReceipt({ hash });
        pushReceipt({ kind: "deposit", txHash: hash, detail: `Minted ${units} test ${config.token.symbol}` });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, address, walletClient, publicClient, refresh],
  );

  const deposit = useCallback(
    async (units: number) =>
      run("deposit", undefined, async (step) => {
        if (!config) throw new Error("config not loaded");
        if (!address) throw new Error("connect your wallet first");

        step(`Proving deposit (${config.circuits.deposit.constraints.toLocaleString()} constraints)`);
        const prepared = CLIENT_PROVING
          ? await clientActions.prepareDeposit(
              await vault.context(),
              units,
              proveOptions(step, "deposit"),
            )
          : await prepareDeposit(units);

        const raw = BigInt(prepared.units) * BigInt(config.poolState.denomination);
        const balance = (await publicClient.readContract({
          address: config.collateral,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        })) as bigint;
        if (balance < raw) {
          throw new Error(
            `you hold ${balance / BigInt(config.poolState.denomination)} ${config.token.symbol}, ` +
              `this deposit needs ${prepared.units}. Use the faucet first.`,
          );
        }

        const allowance = (await publicClient.readContract({
          address: config.collateral,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, config.pool],
        })) as bigint;

        if (allowance < raw) {
          step("Approve the pool to move your collateral");
          const approveHash = await (await walletClient()).writeContract({
            address: config.collateral,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [config.pool, raw],
            chain: null,
            account: address,
          });
          step("Waiting for the approval");
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        step("Confirm the deposit in your wallet");
        const hash = await (await walletClient()).writeContract({
          address: config.pool,
          abi: DEPOSIT_ABI,
          functionName: "deposit",
          args: [
            prepared.pA.map(BigInt) as unknown as readonly [bigint, bigint],
            prepared.pB.map((r) => r.map(BigInt)) as unknown as readonly [readonly [bigint, bigint], readonly [bigint, bigint]],
            prepared.pC.map(BigInt) as unknown as readonly [bigint, bigint],
            BigInt(prepared.commitment),
            BigInt(prepared.units),
          ],
          // Real testnet deposit measures ~1,816,000 gas (HANDOFF.md), 30-55% over any local
          // or wallet-estimated figure -- calldata and cold-storage costs a naive estimate
          // misses. Wallet auto-estimation undershot this to 1,000,000 and reverted out of gas
          // in practice; declaring it explicitly, with headroom, is the fix.
          gas: 2_200_000n,
          chain: null,
          account: address,
        });
        step("Waiting for confirmation");
        const rc = await publicClient.waitForTransactionReceipt({ hash });
        if (rc.status !== "success") throw new Error("the deposit transaction reverted");
        if (CLIENT_PROVING) {
          await clientActions.confirmDeposit(await vault.context(), prepared.id, hash);
        } else {
          await confirmDeposit(prepared.id, hash);
        }
        pushReceipt({
          kind: "deposit",
          txHash: hash,
          provingMs: prepared.provingMs,
          noteId: prepared.id,
          gasUsed: rc.gasUsed.toString(),
          detail: `${units} units deposited. Your note joins the next batch.`,
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, address, walletClient, publicClient, refresh],
  );

  function relayed(kind: ActivityKind, r: RelayedResult, detail: string, noteId?: string, spentNoteId?: string) {
    pushReceipt({
      kind,
      txHash: r.txHash,
      relayer: r.relayer,
      gasUsed: r.gasUsed,
      provingMs: r.provingMs,
      noteId,
      spentNoteId,
      detail,
    });
  }

  const bet = useCallback(
    async (noteId: string, marketId: number, side: "yes" | "no") =>
      run("bet", noteId, async (step) => {
        step(
          config
            ? `Proving the bet (${config.circuits.bet.constraints.toLocaleString()} constraints), then relaying`
            : "Proving the bet, then relaying",
        );
        const r = CLIENT_PROVING
          ? await clientActions.bet(await vault.context(), noteId, marketId, side, proveOptions(step, "the bet"))
          : await doBet(noteId, marketId, side);
        relayed("bet", r, `${side.toUpperCase()} position sealed. Your address is not on this transaction.`, r.id, noteId);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, refresh],
  );

  const redeem = useCallback(
    async (noteId: string) =>
      run("redeem", noteId, async (step) => {
        step(
          config
            ? `Proving the redemption (${config.circuits.redeem.constraints.toLocaleString()} constraints), then relaying`
            : "Proving the redemption, then relaying",
        );
        let r;
        if (CLIENT_PROVING) {
          // The circuit's divisors must be the SETTLED totals, and the contract pins them --
          // so they are read fresh here rather than taken from the polled market list, which
          // can be up to POLL_MS stale and would prove against numbers the contract rejects.
          const { market } = await fetchMarket(Number(exposedNotes.find((n) => n.id === noteId)?.marketId ?? 0));
          r = await clientActions.redeem(await vault.context(), noteId, market, proveOptions(step, "the redemption"));
        } else {
          r = await doRedeem(noteId);
        }
        relayed("redeem", r, `Paid into a shielded note of ${r.payout} units. No collateral moved.`, r.id, noteId);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, refresh],
  );

  const withdraw = useCallback(
    async (noteId: string, amount: number, recipient: string) =>
      run("withdraw", noteId, async (step) => {
        step(
          config
            ? `Proving the withdrawal (${config.circuits.withdraw.constraints.toLocaleString()} constraints), then relaying`
            : "Proving the withdrawal, then relaying",
        );
        let r;
        if (CLIENT_PROVING) {
          if (!config) throw new Error("config not loaded");
          // Rung occupancy and the floor both move, so both are read live -- the server path
          // reads them inside its action for the same reason.
          const [atRung, minAnonymitySet] = (await Promise.all([
            publicClient.readContract({
              address: config.pool,
              abi: config.poolAbi as never,
              functionName: "depositsAtDenomination",
              args: [BigInt(amount)],
            }),
            publicClient.readContract({
              address: config.pool,
              abi: config.poolAbi as never,
              functionName: "minAnonymitySet",
            }),
          ])) as [bigint, bigint];
          r = await clientActions.withdraw(
            await vault.context(),
            noteId,
            amount,
            recipient,
            { atRung, minAnonymitySet },
            proveOptions(step, "the withdrawal"),
          );
        } else {
          r = await doWithdraw(noteId, amount, recipient);
        }
        relayed("withdraw", r, `${amount} units sent to ${r.recipient}.`, r.changeId ?? undefined, noteId);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, refresh],
  );

  const value: Value = useMemo(
    () => ({
      config,
      markets,
      pool,
      notes: exposedNotes,
      activity,
      receipt,
      receiptHistory,
      error,
      walletUnits,
      getOddsHistory: (marketId: number) => oddsHistoryRef.current.get(marketId) ?? [],
      clientProving: CLIENT_PROVING,
      vaultUnlocked: vault.unlocked,
      refresh,
      dismissReceipt: () => setReceipt(null),
      clearError: () => setError(null),
      deposit,
      faucet,
      bet,
      redeem,
      withdraw,
    }),
    [config, markets, pool, exposedNotes, activity, receipt, receiptHistory, error, walletUnits, vault.unlocked, refresh, deposit, faucet, bet, redeem, withdraw],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMarket(): Value {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMarket must be used within a MarketProvider");
  return ctx;
}

export function useOddsHistory(marketId: number): { t: number; pct: number }[] {
  return useMarket().getOddsHistory(marketId);
}
