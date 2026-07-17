// URIZEN's strategy set — the autonomous mandates the fund runs across the on-chain
// stock market, real-world assets and crypto on Robinhood Chain. Each is a bounded,
// rules-based module executed onchain from the fund's wallet.
//
// `status`: "live" = executing now · "arming" = automation being wired for continuous run.
// Targets reference real Robinhood-Chain tokenized equities (see stocks.ts).

export type Strategy = {
  id: string;
  name: string;
  kind: "DCA" | "Momentum" | "Rotation" | "Yield" | "Buyback" | "Hedge";
  status: "live" | "arming";
  summary: string;
  targets: string[]; // stock/asset symbols
  cadence: string; // human-readable schedule
  allocationPct: number; // target sleeve of the book
};

export const STRATEGIES: Strategy[] = [
  {
    id: "mag7-dca",
    name: "Magnificent Seven · Programmatic DCA",
    kind: "DCA",
    status: "live",
    summary:
      "Dollar-cost averages a fixed USDG budget into the megacap seven on every session, weighted by trailing volatility. Accumulates the index that never sleeps.",
    targets: ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA"],
    cadence: "Every 6h · 24/7",
    allocationPct: 34,
  },
  {
    id: "ai-momentum",
    name: "Silicon Momentum · AI Compute",
    kind: "Momentum",
    status: "live",
    summary:
      "Rotates into the strongest AI-compute names (NVDA / AMD / CRWV / MU) on 20/50 trend confirmation, trims on momentum breaks. Long the buildout, flat the fade.",
    targets: ["NVDA", "AMD", "CRWV", "MU"],
    cadence: "Signal-driven · continuous",
    allocationPct: 22,
  },
  {
    id: "index-rotation",
    name: "Index Rotation · SPY / QQQ",
    kind: "Rotation",
    status: "live",
    summary:
      "Holds the broad market via tokenized SPY & QQQ, tilts toward whichever leads on relative strength. The passive core, actively tilted.",
    targets: ["SPY", "QQQ"],
    cadence: "Daily rebalance",
    allocationPct: 18,
  },
  {
    id: "overnight-gap",
    name: "Overnight Edge · The Off-Hours Book",
    kind: "Momentum",
    status: "arming",
    summary:
      "Trades the gap between when Wall Street closes and Robinhood Chain doesn't — positions megacaps into weekend and after-hours flow that legacy markets can't touch.",
    targets: ["NVDA", "AAPL", "TSLA", "META"],
    cadence: "Nights & weekends",
    allocationPct: 10,
  },
  {
    id: "treasury-yield",
    name: "Idle-Cash Yield · USDG",
    kind: "Yield",
    status: "live",
    summary:
      "Parks unallocated USDG into tokenized T-bills (SGOV) and on-chain lending so the book's cash leg is never idle. Real yield on the sidelines.",
    targets: ["SGOV", "USDG"],
    cadence: "Continuous",
    allocationPct: 10,
  },
  {
    id: "uri-buyback",
    name: "Reflexive Buyback · $URI",
    kind: "Buyback",
    status: "arming",
    summary:
      "Routes trading fees and realized performance back into the open market to buy $URI. Every trade the fund makes bids for the token.",
    targets: ["URI"],
    cadence: "On fee accrual",
    allocationPct: 6,
  },
];

export const liveCount = () => STRATEGIES.filter((s) => s.status === "live").length;
