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

const POLL_MS = 5000;
/** ~5 min of session-local odds history at the current poll rate -- not fetched, not persisted,
 * gone on refresh. Honest labeling of this (see Sparkline.tsx) matters: it is the actually-
 * observed record of this browser tab's session, never a stand-in for real price history. */
const ODDS_HISTORY_CAP = 60;

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
  const { session, address, walletClient, publicClient } = useWallet();

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
        const prepared = await prepareDeposit(units);

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
        await confirmDeposit(prepared.id, hash);
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
        const r = await doBet(noteId, marketId, side);
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
        const r = await doRedeem(noteId);
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
        const r = await doWithdraw(noteId, amount, recipient);
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
      notes,
      activity,
      receipt,
      receiptHistory,
      error,
      walletUnits,
      getOddsHistory: (marketId: number) => oddsHistoryRef.current.get(marketId) ?? [],
      refresh,
      dismissReceipt: () => setReceipt(null),
      clearError: () => setError(null),
      deposit,
      faucet,
      bet,
      redeem,
      withdraw,
    }),
    [config, markets, pool, notes, activity, receipt, receiptHistory, error, walletUnits, refresh, deposit, faucet, bet, redeem, withdraw],
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
