/**
 * Market research for /thesis.
 *
 * EVERY NUMBER CARRIES ITS SOURCE AND ITS DATE, and the type makes that non-optional. This page
 * is written to be shown to people who will check, and an uncited figure is worse than no figure
 * -- it is the one thing that would make a reader stop believing the rest of it.
 *
 * These are hardcoded research findings rather than live data, which is honest so long as it is
 * labelled: the page states its as-of date and every claim links out. Nothing here is
 * interpolated, rounded in our favour, or reconstructed from memory. Where credible sources
 * disagree -- the 2030 forecasts do -- both are shown.
 *
 * Collected 9 August 2026. Re-check before reusing: this category moved 20x in twelve months,
 * so a stale figure here is a liability rather than a rough guide.
 */

export const AS_OF = "9 August 2026";

export interface Cited {
  /** The figure itself, formatted for display. */
  value: string;
  label: string;
  /** When the figure was measured, not when it was published. */
  when: string;
  source: string;
  url: string;
  /** Context that stops the number being read wrong. */
  note?: string;
}

/** The category as it exists today, not as a projection. */
export const SIZE: Cited[] = [
  {
    value: "$31B",
    label: "Kalshi monthly volume",
    when: "June 2026",
    source: "SGI Europe",
    url: "https://www.sgieurope.com/technology/kalshi-booms-on-sports/121847.article",
    note: "A platform record, driven by the 2026 World Cup.",
  },
  {
    value: "$25.7B",
    label: "Polymarket monthly volume, peak",
    when: "March 2026",
    source: "MEXC News",
    url: "https://www.mexc.com/news/1062153",
    note: "Up from roughly $1.2B a month through 2025.",
  },
  {
    value: "1.29M",
    label: "Polymarket wallets that traded",
    when: "Q1 2026",
    source: "MEXC News",
    url: "https://www.mexc.com/news/1062153",
  },
  {
    value: "2–4M",
    label: "Kalshi active monthly users",
    when: "2026",
    source: "TSG Invest",
    url: "https://tsginvest.com/kalshi/",
    note: "Company-reported. Third-party trackers put it as high as 5M.",
  },
  {
    value: "$22B",
    label: "Kalshi valuation",
    when: "May 2026",
    source: "Kalshi",
    url: "https://news.kalshi.com/p/kalshi-raises-1-billion-22-billion-valuation-institutional-demand-surges",
    note: "$1B Series F led by Coatue, with Sequoia, a16z, Paradigm and Morgan Stanley.",
  },
  {
    value: "$20B",
    label: "Polymarket target valuation",
    when: "August 2026",
    source: "CoinDesk",
    url: "https://www.coindesk.com/markets/2026/08/04/polymarket-targets-usd20-billion-valuation-as-competition-heats-up-in-prediction-markets",
  },
];

/** How fast it got here, and where the sell-side thinks it goes. */
export const GROWTH: { period: string; fact: string; source: string; url: string }[] = [
  {
    period: "2025 → early 2026",
    fact: "Polymarket monthly volume went from about $1.2B to more than $20B, with active wallets more than tripling in six months.",
    source: "CoinDesk",
    url: "https://x.com/CoinDesk/status/2050581591836004423",
  },
  {
    period: "Six months to mid-2026",
    fact: "Kalshi institutional trading volume grew 800%. Institutions arriving is what changes who cares about being watched.",
    source: "SGI Europe",
    url: "https://www.sgieurope.com/technology/kalshi-booms-on-sports/121847.article",
  },
  {
    period: "By 2030",
    fact: "Bernstein projects roughly $1 trillion in annual prediction-market volume, about an 80% CAGR from 2025.",
    source: "CNBC",
    url: "https://www.cnbc.com/2026/04/14/prediction-markets-will-grow-to-1-trillion-by-2030-bernstein-says.html",
  },
  {
    period: "By 2030",
    fact: "Macquarie models closer to $1.5 trillion in annual taker volume, from roughly $22B a year earlier — the same trajectory from a second independent house.",
    source: "Casino.org",
    url: "https://www.casino.org/news/macquarie-prediction-market-volume-could-reach-1-5-trillion-by-2030/",
  },
  {
    period: "By 2030",
    fact: "Citizens expects sector revenue to grow fivefold, to more than $10B a year.",
    source: "Bloomberg",
    url: "https://www.bloomberg.com/news/articles/2025-12-15/prediction-markets-will-see-5-fold-growth-by-2030-citizens-says",
  },
];

/**
 * The concentration data — the section that decides whether this product has a customer.
 *
 * The median user is not it. The customer is the small cohort whose positions are worth copying,
 * and they are exactly the people transparency costs money.
 */
export const CONCENTRATION: Cited[] = [
  {
    value: "0.55%",
    label: "of profitable maker wallets took half of all gains",
    when: "Dec 2025 – Feb 2026, politics markets",
    source: "CoinDesk",
    url: "https://www.coindesk.com/markets/2026/04/29/a-tiny-group-is-winning-on-polymarket-as-under-1-of-wallets-take-half-the-profits",
  },
  {
    value: "~3%",
    label: "of traders drive most price discovery",
    when: "academic analysis cited 2026",
    source: "Arkham",
    url: "https://info.arkm.com/research/how-to-track-polymarket-whales",
  },
  {
    value: "$6.50",
    label: "average trade size for the median user",
    when: "May–June 2026, 11,989 wallets",
    source: "Pew Research Center",
    url: "https://www.pewresearch.org/short-reads/2026/07/22/what-we-know-about-the-typical-polymarket-user/",
    note: "The median user spent about $600 over six weeks. The volume is not coming from them — it comes from the cohort above.",
  },
];

/** Evidence that public order flow is actively harvested. */
export const SURVEILLANCE: { title: string; body: string; source: string; url: string }[] = [
  {
    title: "Copy-trading is an industry, not a hypothetical",
    body: "The trading terminal Stand launched Polymarket copy-and-counter trading in February 2026 and had tracked over 1,500 wallets and 5,000 strategies within two months. Polymarket itself shipped a product called COPYCAT.",
    source: "Polymarket",
    url: "https://news.polymarket.com/p/copycat",
  },
  {
    title: "Every order is public, including the cancellations",
    body: "On the on-chain venue every limit order, market buy and cancellation is visible — which markets a profitable trader is entering, at what size, and when they leave.",
    source: "AlphaScope",
    url: "https://www.alphascope.app/blog/polymarket-copy-trading",
  },
  {
    title: "Being followed costs the followed trader money",
    body: "When enough people mirror one wallet, price moves the moment it trades. Sharp traders now split fills and route around trackers — a cat-and-mouse tax paid entirely by the person who had the edge.",
    source: "Tradox",
    url: "https://tradoxvps.com/polymarket-copy-trading/",
  },
];

/** Willingness to pay for privacy, measured somewhere it can actually be observed. */
export const PRIVACY_DEMAND: Cited[] = [
  {
    value: "11% → 30%",
    label: "of Zcash supply moved into the shielded pool in one year",
    when: "2025 → 2026",
    source: "Delphi Digital",
    url: "https://x.com/Delphi_Digital/status/2019547466668863546",
    note: "More growth than the previous eight years combined, and shielded coins are held longer once they are in.",
  },
  {
    value: "59.3%",
    label: "of Zcash transactions used shielding — an all-time high",
    when: "February 2026",
    source: "The Block",
    url: "https://www.theblock.co/post/378232/zcash-shielded-pool-climbs-23-supply-network-usage-surges",
  },
  {
    value: "~$80M",
    label: "crossed into Zcash's new Ironwood pool on its first day",
    when: "29 July 2026",
    source: "CoinDesk",
    url: "https://www.coindesk.com/tech/2026/07/29/about-usd80-million-zec-crosses-into-zcash-s-new-ironwood-pool-in-the-first-day",
  },
];
