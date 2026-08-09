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
 * disagree -- the 2030 forecasts do, by 50% -- both are shown rather than the flattering one.
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
    note: "June 2026 came in at $10.8B. This category is spiky, not smooth.",
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
    fact: "Macquarie models closer to $1.5 trillion in annual taker volume, from roughly $22B a year earlier — a 50% spread between two credible houses on the same question.",
    source: "Casino.org",
    url: "https://www.casino.org/news/macquarie-prediction-market-volume-could-reach-1-5-trillion-by-2030/",
  },
  {
    period: "By 2030",
    fact: "Citizens expects sector revenue to grow fivefold to more than $10B — worth holding next to the volume numbers, because they are two orders of magnitude apart.",
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
    note: "The median user spent about $600 over six weeks and finished down less than $2. The volume is not coming from them.",
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

/**
 * The risks. Not a footnote.
 *
 * Regulatory pressure is currently pushing toward MORE identification, which is the strongest
 * argument against this company. Burying it is the fastest way to lose a sophisticated reader,
 * and it is checkable in about four minutes.
 */
export const RISKS: { title: string; body: string; source?: string; url?: string }[] = [
  {
    title: "Regulation is moving toward identification, not away from it",
    body: "The CFTC issued an advance notice of proposed rulemaking on prediction markets in March 2026 and a proposed rule in June, and its enforcement division named AML/KYC violations among five priority areas alongside a new insider-trading framework for prediction markets. Commenters have pushed for collecting taxpayer identifiers above a balance threshold. A privately-settled venue is not addressable inside that perimeter.",
    source: "Sullivan & Cromwell",
    url: "https://www.sullcrom.com/insights/memo/2026/April/CFTC-Updates-Enforcement-Priorities-Cooperation-Policy-Prediction-Markets-Insider-Trading",
  },
  {
    title: "Privacy and insider trading are being discussed in the same breath",
    body: "House Oversight opened an investigation into both venues in May 2026 over federal employees possibly trading on non-public information, and the first criminal case — an Army master sergeant charged in April over $409,000 made on classified operational knowledge — is already in court. Any privacy product in this category will be asked whether it exists to defeat that scrutiny, and needs an answer ready.",
    source: "CNBC",
    url: "https://www.cnbc.com/2026/05/22/kalshi-polymarket-comer-insider-trading-probe-congress.html",
  },
  {
    title: "The addressable slice is the on-chain venue, not the regulated one",
    body: "Kalshi KYCs every user, is CFTC-registered, and claims over 90% of US prediction-market activity. That volume is structurally closed to a private protocol. What remains is crypto-native, non-US on-chain flow — a fraction of the headline numbers, and it should be modelled that way rather than by quoting the category total.",
  },
  {
    title: "Capital velocity caps revenue per dollar of deposits",
    body: "Parimutuel settlement means a dollar enters once and sits until resolution, where an order book turns the same dollar many times. Fee revenue scales with turnover, so Atrum will not post volume comparable to a venue holding the same deposits. That is a consequence of the privacy design, not a gap in the roadmap.",
  },
];
