import { json, options } from "@/lib/api";
import { URIZEN_TOKEN, URIZEN_POOL, ROBINHOOD_CHAIN } from "@/lib/chain";

export const revalidate = 300;
export const OPTIONS = options;

// The URIZEN Skill — a machine-readable capabilities manifest so any AI agent (Bankr, MCP client,
// autonomous treasury) can price, buy, hold, mirror and read the fund. This is the "scale file":
// the fund exposed as an on-chain-native primitive other agents plug into.
export async function GET() {
  return json({
    name: "urizen",
    provider: "URIZEN",
    description:
      "Urizen, as one API. An AI equity-research desk on Robinhood Chain — charts + technicals, SEC fundamentals, filings & insiders, analyst consensus, news, the macro calendar, prediction-market odds and on-chain price for any tokenized stock — plus the autonomous fund's live strategies, on-chain book, execution tape, and one-token exposure via $URI. All read-only and keyless; the only trade is a ready-to-sign $URI buy the human signs.",
    version: "0.5.0",
    homepage: "https://urizenfund.com",
    app: "https://urizenfund.com/alpha",
    x: "https://x.com/urizenfund",
    chain: { name: "Robinhood Chain", id: ROBINHOOD_CHAIN.id, cashLeg: "USDG" },
    token: {
      symbol: "URI",
      name: "Urizen",
      address: URIZEN_TOKEN,
      chainId: ROBINHOOD_CHAIN.id,
      chain: "robinhood",
      decimals: 18,
      poolId: URIZEN_POOL,
      pair: "WETH",
    },
    capabilities: [
      // — research desk (read-only, keyless, CORS-open) —
      { id: "ohlc", group: "research", method: "GET", path: "/api/quant/ohlc?symbol=NVDA&range=6m", desc: "Real daily OHLC for any tokenized stock (ranges 1m·3m·6m·1y·2y) — compute RSI, volatility, Sharpe, drawdown, moving averages." },
      { id: "fundamentals", group: "research", method: "GET", path: "/api/quant/fundamentals?symbol=NVDA", desc: "Latest SEC filing fundamentals — revenue, net income, margin, EPS, assets, equity." },
      { id: "filings", group: "research", method: "GET", path: "/api/quant/filings?symbol=NVDA", desc: "Recent SEC filings (10-K/10-Q/8-K) and insider Form 4 activity with links." },
      { id: "ratings", group: "research", method: "GET", path: "/api/quant/ratings?symbol=NVDA", desc: "Wall Street analyst consensus — strong buy/buy/hold/sell breakdown and trend." },
      { id: "news", group: "research", method: "GET", path: "/api/quant/news?symbol=NVDA", desc: "Latest financial news headlines for a stock (or the market)." },
      { id: "macro", group: "research", method: "GET", path: "/api/quant/macro", desc: "Fed funds, CPI, unemployment, 10Y + this week's high-impact US economic calendar with consensus." },
      { id: "market", group: "research", method: "GET", path: "/api/quant/market", desc: "Market pulse — S&P 500, Nasdaq, VIX, US 10Y, dollar index." },
      { id: "onchain", group: "research", method: "GET", path: "/api/quant/onchain?symbol=URI", desc: "Live on-chain price, liquidity and 24h volume for a token on Robinhood Chain." },
      { id: "predictions", group: "research", method: "GET", path: "/api/quant/predictions?q=fed%20rate%20cut", desc: "Real-money prediction-market odds from Polymarket — implied probabilities on events." },
      // — the fund ($URI) —
      { id: "strategies", group: "fund", method: "GET", path: "/api/fund/strategies", desc: "The fund's autonomous mandates — targets and cadence." },
      { id: "book", group: "fund", method: "GET", path: "/api/fund/book", desc: "The fund's live on-chain positions (tokenized equities + crypto) and NAV." },
      { id: "mirror", group: "fund", method: "GET", path: "/api/fund/mirror", desc: "Copy-trade the fund: live target weights of its real book (confirm each rebalance with the user)." },
      { id: "trades", group: "fund", method: "GET", path: "/api/fund/trades", desc: "The fund's live on-chain execution feed." },
      { id: "signals", group: "fund", method: "GET", path: "/api/fund/signals", desc: "The reads behind the book — momentum/trend/RSI + stance on the names it trades." },
      { id: "stats", group: "fund", method: "GET", path: "/api/fund/stats", desc: "Live $URI price, market cap, liquidity, holders." },
      // — trade: buy $URI (non-custodial; the human signs). Validate chain 4663 + $URI addr + router + calldata. —
      { id: "uri_quote", group: "trade", method: "GET", path: "/api/fund/quote?side=buy&amount=0.01&taker=0x", desc: "Ready-to-sign $URI buy tx (native ETH in, no approval). amount is native ETH. Validate chain 4663, the $URI address, router and selector before signing." },
    ],
    buy: {
      natural_language: "@bankrbot buy $URI",
      app: "https://ctrl.build/urizen",
      note: "Native ETH in, no approval; the tx credits the connected wallet. Validate chain 4663 + $URI address + router before signing.",
    },
    note: "Free-form swaps of other tokenized stocks are in-app only (https://urizenfund.com/alpha) where the human signs — not an agent endpoint.",
    disclaimer: "Research, not investment advice. Non-custodial — the agent never holds keys or trades for the user.",
    updatedAt: new Date().toISOString(),
  });
}
