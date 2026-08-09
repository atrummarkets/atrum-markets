import type { LiveMarket } from "@/lib/atrum/api";

/**
 * Odds and payouts, honestly.
 *
 * THE PROTOTYPE GOT THIS WRONG, AND IT MATTERS. It priced bets like shares -- "64¢ per share,
 * you get 39.1" -- which is how an order-book market works. Atrum is PARIMUTUEL: there is no
 * counterparty and no share price. Winners divide the whole pool pro rata:
 *
 *     payout = units * totalPool / winningPool          (truncated down, see redeem_private)
 *
 * Both pools keep moving until betting closes, so the payout for a bet placed now is genuinely
 * unknown at the time it is placed. A single confident number on the ticket would be invented,
 * which this codebase does not do -- so every projection here is labelled as conditional on the
 * pool not moving, and the UI says so out loud.
 */

/** Implied probability of YES, from the pool split. 50% when nobody has bet either side. */
export function impliedYesPct(market: Pick<LiveMarket, "yesUnits" | "noUnits">): number {
  const total = market.yesUnits + market.noUnits;
  if (total === 0) return 50;
  return Math.round((market.yesUnits / total) * 100);
}

/** Odds as a price in cents, the shorthand traders read fastest. */
export function centsFor(pct: number): string {
  return `${Math.round(pct)}¢`;
}

export interface Projection {
  /** Payout if the pool ends exactly as it stands right now, including this bet. */
  payout: number;
  /** Profit over the stake. */
  profit: number;
  /** payout / stake. 1 means no losers, so nothing to win. */
  multiple: number;
  /**
   * True when this side currently has no opposition, so the payout is 1:1 and the "profit" is
   * zero. Worth surfacing plainly -- a market where nobody has taken the other side pays your
   * own money back, and a UI that showed "2.0x" there would be lying.
   */
  unopposed: boolean;
}

/**
 * What a stake would pay if the pool froze the instant after it landed.
 *
 * Includes the stake itself on the chosen side, because it genuinely does move the odds -- a
 * projection that ignored it would overstate the return of every large bet.
 *
 * Truncating down matches the in-circuit constraint
 * `units * totalPool == payout * winningPool + remainder`, which is what keeps the sum of all
 * payouts strictly under the pool.
 */
export function project(
  market: Pick<LiveMarket, "yesUnits" | "noUnits">,
  side: "YES" | "NO",
  stake: number,
): Projection {
  if (stake <= 0) return { payout: 0, profit: 0, multiple: 1, unopposed: false };

  const yes = market.yesUnits + (side === "YES" ? stake : 0);
  const no = market.noUnits + (side === "NO" ? stake : 0);
  const total = yes + no;
  const winning = side === "YES" ? yes : no;

  if (winning === 0) return { payout: 0, profit: 0, multiple: 1, unopposed: true };

  const payout = Math.floor((stake * total) / winning);
  return {
    payout,
    profit: Math.max(0, payout - stake),
    multiple: payout / stake,
    unopposed: (side === "YES" ? market.noUnits : market.yesUnits) === 0,
  };
}

/**
 * What a settled winning note is worth. Not a projection -- the pools are final.
 *
 * Same arithmetic the circuit constrains, so the number shown is the number redeem produces.
 */
export function settledPayout(
  market: Pick<LiveMarket, "yesUnits" | "noUnits" | "outcome" | "settled">,
  units: number,
): number | null {
  if (!market.settled || market.outcome === "UNRESOLVED") return null;
  const total = market.yesUnits + market.noUnits;
  const winning = market.outcome === "YES" ? market.yesUnits : market.noUnits;
  if (winning === 0) return null;
  return Math.floor((units * total) / winning);
}

/** "in 4h" / "in 12d" / "closed". Compact enough for a market row. */
export function closesIn(bettingCloseTime: number, now = Date.now()): string {
  const seconds = bettingCloseTime - Math.floor(now / 1000);
  if (seconds <= 0) return "closed";
  if (seconds < 3600) return `in ${Math.max(1, Math.round(seconds / 60))}m`;
  if (seconds < 86400) return `in ${Math.round(seconds / 3600)}h`;
  return `in ${Math.round(seconds / 86400)}d`;
}
