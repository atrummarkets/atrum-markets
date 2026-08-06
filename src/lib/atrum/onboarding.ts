import { useWallet } from "./wallet";
import { useMarket } from "./marketContext";
import { useDetailMode } from "./detailMode";

/**
 * The first-run sequence HANDOFF.md's "0-quater" names as the biggest product gap: every
 * screen explains itself, nothing explains the ORDER. This derives "what should this person do
 * next" purely from real wallet/note/pool state -- never a stored flag -- so it is naturally
 * skippable and resumable: someone who already holds a grafted note is never told to deposit
 * again, because the derivation looks at their actual notes, not at whether they've "seen this
 * before."
 *
 * Derivation (kind, action, link) is one thing; the words used to describe a kind are another --
 * split so the hard, already-correct state-derivation logic stays untouched by the simple/
 * detailed copy split below it.
 */
export type OnboardingStepKind =
  | "connect"
  | "switch-chain"
  | "prerequisites"
  | "deposit"
  | "waiting-graft"
  | "bet"
  | "redeem"
  | "withdraw"
  | "done";

export interface OnboardingStep {
  kind: OnboardingStepKind;
  title: string;
  detail: string;
  /** A button that runs a wallet action in place (connect, switch network). */
  action?: { label: string; run: () => void | Promise<void> };
  /** A link elsewhere in the app, or out to an external faucet. Mutually exclusive with `action`. */
  link?: { label: string; href: string };
}

interface CopyData {
  symbol?: string;
  walletUnits?: number | null;
  queuedCount?: number;
  batchCount?: number;
}

type CopyFn = (d: CopyData) => { title: string; detail: string };

const simpleCopy: Record<OnboardingStepKind, CopyFn> = {
  connect: () => ({
    title: "Connect your wallet",
    detail: "One signature. No transaction, no gas.",
  }),
  "switch-chain": () => ({
    title: "Switch network",
    detail: "Atrum runs on Monad testnet.",
  }),
  prerequisites: (d) => ({
    title: "Get testnet funds",
    detail: `You'll need testnet MON for gas and some test ${d.symbol ?? "collateral"} before your first deposit.`,
  }),
  deposit: (d) => ({
    title: "Add funds",
    detail: `You hold ${d.walletUnits ?? 0} ${d.symbol ?? "collateral"}. Add it to your balance to start trading.`,
  }),
  "waiting-graft": () => ({
    title: "Almost ready",
    detail: "Your funds are joining the shared pool. This wait is what keeps every trader private, including you.",
  }),
  bet: () => ({
    title: "Place a trade",
    detail: "Pick a market, choose a side.",
  }),
  redeem: () => ({
    title: "Claim your winnings",
    detail: "You won. Claim it now, then send it to your wallet whenever you like -- waiting a bit keeps it private.",
  }),
  withdraw: () => ({
    title: "Send to your wallet",
    detail: "Ready whenever you are. Waiting a bit before sending keeps it private.",
  }),
  done: () => ({ title: "", detail: "" }),
};

const detailedCopy: Record<OnboardingStepKind, CopyFn> = {
  connect: () => ({
    title: "Connect your wallet",
    detail: "One signature, no transaction and no gas, proves the address is yours so the server can hand back your notes.",
  }),
  "switch-chain": () => ({
    title: "Switch to Monad testnet",
    detail: "Atrum runs on Monad testnet (chain 10143). Everything below needs this network.",
  }),
  prerequisites: (d) => ({
    title: "Get testnet funds",
    detail: `You need testnet MON for gas (external faucet) and some test ${d.symbol ?? "collateral"} (in-app, permissionless mint) before your first deposit.`,
  }),
  deposit: (d) => ({
    title: "Make your first deposit",
    detail: `You hold ${d.walletUnits ?? 0} ${d.symbol ?? "collateral"}. Depositing turns it into a note -- Atrum has no account balance, only notes.`,
  }),
  "waiting-graft": (d) => ({
    title: "Your note is queued",
    detail:
      d.queuedCount !== undefined
        ? `${d.queuedCount} note${d.queuedCount === 1 ? "" : "s"} waiting, ${d.batchCount ?? 0} batches grafted so far. The wait IS the privacy -- your note is entering the anonymity set, not stuck.`
        : "Waiting for the sequencer to graft your note into the tree. This is the anonymity set assembling, not a delay to apologise for.",
  }),
  bet: () => ({
    title: "Place a bet",
    detail: "You hold a spendable note. A bet spends the WHOLE note on one side of one market -- there is no partial-bet amount field, because the amount would leak.",
  }),
  redeem: () => ({
    title: "Redeem your winning position",
    detail: "Redeeming does not pay you directly -- it mints a new shielded note for your winnings. Withdraw is a separate, later step; that split is what protects a winner from being identified.",
  }),
  withdraw: () => ({
    title: "Withdraw a settled note",
    detail: "This note is ready to leave as public collateral, to any address, whenever you choose. Waiting longer before withdrawing makes it harder to link to the bet that earned it.",
  }),
  done: () => ({ title: "", detail: "" }),
};

export function useOnboardingStep(): OnboardingStep {
  const { session, chainOk, connect, switchChain, connecting } = useWallet();
  const { config, pool, notes, markets, walletUnits } = useMarket();
  const { mode } = useDetailMode();
  const copy = mode === "detailed" ? detailedCopy : simpleCopy;

  if (!session) {
    return {
      kind: "connect",
      ...copy.connect({}),
      action: { label: connecting ? "Connecting…" : "Connect wallet", run: connect },
    };
  }

  if (!chainOk) {
    return {
      kind: "switch-chain",
      ...copy["switch-chain"]({}),
      action: { label: "Switch network", run: switchChain },
    };
  }

  const symbol = config?.token.symbol ?? "collateral";
  const queued = notes.filter((n) => n.status === "queued");
  const collateral = notes.filter((n) => n.status === "grafted" && n.outcome === 0);
  const settledMarkets = new Set(markets.filter((m) => m.settled).map((m) => String(m.marketId)));
  const won = notes.filter(
    (n) =>
      n.status === "grafted" &&
      (n.outcome === 1 || n.outcome === 2) &&
      settledMarkets.has(n.marketId) &&
      markets.some(
        (m) => String(m.marketId) === n.marketId && ((m.outcome === "YES" && n.outcome === 1) || (m.outcome === "NO" && n.outcome === 2)),
      ),
  );
  const withdrawable = notes.filter((n) => n.status === "grafted" && n.outcome === 3);

  // Nobody has deposited anything yet: state both prerequisites together, before the first
  // click, rather than letting the user discover the MON requirement only when a transaction
  // errors.
  if (notes.length === 0 && (walletUnits === null || walletUnits === 0)) {
    return {
      kind: "prerequisites",
      ...copy.prerequisites({ symbol }),
      link: { label: "Go to your wallet", href: "/wallet" },
    };
  }

  if (notes.length === 0 && walletUnits !== null && walletUnits > 0) {
    return {
      kind: "deposit",
      ...copy.deposit({ symbol, walletUnits }),
      link: { label: "Add funds", href: "/wallet" },
    };
  }

  // The queue is a step, not a dead end: this is the waiting-for-graft state the product spec
  // calls out as the sharpest place a newcomer concludes the app is broken.
  if (queued.length > 0 && collateral.length === 0 && won.length === 0 && withdrawable.length === 0) {
    return {
      kind: "waiting-graft",
      ...copy["waiting-graft"]({ queuedCount: pool?.queuedCount, batchCount: pool?.batchCount }),
      link: { label: "See queue", href: "/wallet" },
    };
  }

  if (collateral.length > 0) {
    return {
      kind: "bet",
      ...copy.bet({}),
      link: { label: "See markets", href: "/markets" },
    };
  }

  if (won.length > 0) {
    return {
      kind: "redeem",
      ...copy.redeem({}),
      link: { label: "Go to your portfolio", href: "/portfolio" },
    };
  }

  if (withdrawable.length > 0) {
    return {
      kind: "withdraw",
      ...copy.withdraw({}),
      link: { label: "Go to your portfolio", href: "/portfolio" },
    };
  }

  return { kind: "done", title: "", detail: "" };
}
