export type MarketPhase = "betting" | "closed" | "resolved" | "settled";

export interface LiveMarket {
  marketId: number;
  question: string;
  category: string;
  phase: MarketPhase;
  outcome: "YES" | "NO" | "UNRESOLVED";
  bettingCloseTime: number;
  resolutionStartTime: number;
  yesUnits: number;
  noUnits: number;
  oddsYesPct: number;
  settled: boolean;
  vault: string;
}

export interface PoolState {
  totalDeposits: number;
  minAnonymitySet: number;
  anonymityOk: boolean;
  queuedCount: number;
  batchCount: number;
  denomination: string;
}

export interface CircuitFacts {
  name: string;
  constraints: number;
  zkeyBytes: number;
  wasmBytes: number;
}

export interface AppConfig {
  chainId: number;
  rpcUrl: string;
  pool: `0x${string}`;
  collateral: `0x${string}`;
  token: { symbol: string; decimals: number };
  poolState: PoolState;
  /** The operator EOA. Resolve/settle are restricted to it; the UI hides its controls. */
  operator: `0x${string}`;
  circuits: Record<"deposit" | "bet" | "redeem" | "withdraw", CircuitFacts>;
  /**
   * The PUBLIC half of the committee key, as decimal strings. A browser proving its own bet
   * encrypts the stake to it. Published because it is the encryption target -- the secret half
   * stays server-side for settlement and the odds board.
   */
  committeePubKey: [string, string];
  /** Whether this deployment proves in the browser rather than on the server. */
  clientProving: boolean;
  poolAbi: unknown[];
}

export interface LiveNote {
  id: string;
  commitment: string;
  marketId: string;
  outcome: number; // 0 unbet, 1 YES, 2 NO, 3 settled
  units: string;
  status: "queued" | "grafted" | "spent";
  label: string;
  createdAt: number;
  txHash?: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `${path} failed (${res.status})`);
  return body as T;
}

const post = <T,>(path: string, payload?: unknown) =>
  api<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

export const fetchConfig = () => api<AppConfig>("/api/atrum/config");
export const fetchMarkets = () => api<{ markets: LiveMarket[]; pool: PoolState }>("/api/atrum/markets");
export const fetchMarket = (id: number) => api<{ market: LiveMarket; pool: PoolState }>(`/api/atrum/markets/${id}`);
export const fetchNotes = () => api<{ notes: LiveNote[] }>("/api/atrum/notes");

export interface PreparedDeposit {
  id: string;
  commitment: string;
  units: string;
  pA: string[];
  pB: string[][];
  pC: string[];
  provingMs: number;
}
export const prepareDeposit = (units: number) => post<PreparedDeposit>("/api/atrum/deposit/prepare", { units });
export const confirmDeposit = (id: string, txHash: string) =>
  post<{ ok: true }>("/api/atrum/deposit/confirm", { id, txHash });

export interface RelayedResult {
  txHash: string;
  relayer: string;
  gasUsed: string;
  provingMs: number;
}

export const doBet = (noteId: string, marketId: number, side: "yes" | "no") =>
  post<RelayedResult & { id: string }>("/api/atrum/bet", { noteId, marketId, side });

export const doRedeem = (noteId: string) =>
  post<RelayedResult & { id: string; payout: string }>("/api/atrum/redeem", { noteId });

export const doWithdraw = (noteId: string, amount: number, recipient: string) =>
  post<RelayedResult & { changeId: string | null; recipient: string }>("/api/atrum/withdraw", {
    noteId,
    amount,
    recipient,
  });

export const doResolve = (marketId: number, side: "YES" | "NO") =>
  post<{ txHash: string }>("/api/atrum/admin/resolve", { marketId, side });

export const doSettle = (marketId: number) =>
  post<{ txHash: string; yes: string; no: string }>("/api/atrum/admin/settle", { marketId });
