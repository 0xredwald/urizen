// Urizen Alpha's toolbelt. Each tool returns text for the model to reason over AND an optional
// UI artifact rendered inline in the chat (a chart, a stats card, a screener table, a swap widget…).
// Grounded in real data — the model interprets, it never fabricates the numbers.

import { fetchOhlc, computeIndicators, type Indicators, type OhlcResponse } from "./quant";
import { STOCKS, bySymbol } from "./stocks";
import { defaultConfig, type AgentConfig } from "./agent-graph";
import type { Mandate } from "./agents";
import type { SwapProposal } from "./rialto";
import { apiBase } from "./api-base";
import { cardUrl } from "./image-gen";

export type NewsItem = { title: string; url: string; publishedAt: string; source: string };
export type MarketItem = { symbol: string; label: string; price: number; changePct: number };
export type OnchainData = { symbol: string; address: string; priceUsd: number | null; liquidityUsd: number | null; volume24h: number | null; priceChange24h: number | null; pairUrl: string | null; note?: string };
export type Fundamentals = { fiscalYear: number; revenue: number | null; netIncome: number | null; netMargin: number | null; eps: number | null; assets: number | null; equity: number | null };
export type Filing = { form: string; date: string; url: string };
export type MacroRate = { label: string; value: string; detail?: string };
export type MacroEvent = { date: string; title: string; impact: string; forecast: string | null; previous: string | null; actual: string | null };
export type RatingTrend = { period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number };
export type PredictionMarket = { question: string; probability: number | null; outcome: string | null; volumeUsd: number | null; url: string };

export type Artifact =
  | { type: "chart"; symbol: string; range: string; data: OhlcResponse; ind: Indicators }
  | { type: "stats"; symbol: string; name: string; ind: Indicators }
  | { type: "screen"; rows: { symbol: string; name: string; ind: Indicators }[]; note: string }
  | { type: "compare"; items: { symbol: string; name: string; ind: Indicators }[] }
  | { type: "swap"; proposal: SwapProposal }
  | { type: "strategy"; name: string; mandate: Mandate; config: AgentConfig }
  | { type: "news"; symbol: string; items: NewsItem[] }
  | { type: "market"; items: MarketItem[] }
  | { type: "onchain"; data: OnchainData }
  | { type: "fundamentals"; symbol: string; name: string; latest: Fundamentals | null; available: boolean; note?: string }
  | { type: "filings"; symbol: string; name: string; filings: Filing[]; insiderRecentCount: number; available: boolean; note?: string }
  | { type: "macro"; rates: MacroRate[]; calendar: MacroEvent[] }
  | { type: "ratings"; symbol: string; name: string; available: boolean; consensus?: string; score?: number; analysts?: number; trend?: RatingTrend[]; note?: string }
  | { type: "predictions"; query: string; markets: PredictionMarket[] }
  | { type: "image"; prompt: string; url: string };

export type ToolOutcome = { text: string; artifact?: Artifact };

const nm = (s: string) => bySymbol(s)?.name ?? s;
const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;

const statLine = (i: Indicators) =>
  `${i.symbol} $${i.price.toFixed(2)} (1d ${pct(i.change1d)}); 1m ${pct(i.return1m)}, 3m ${pct(i.return3m)}, 6m ${pct(i.return6m)}; ` +
  `RSI ${i.rsi14.toFixed(0)}, annVol ${(i.volAnnual * 100).toFixed(0)}%, Sharpe ${i.sharpe.toFixed(2)}, maxDD ${(i.maxDrawdown * 100).toFixed(0)}%, ` +
  `trend ${i.trend}, regime ${i.regime}`;

// ── tool schemas advertised to the model ──
export const ALPHA_TOOLS = [
  {
    name: "show_chart",
    description: "Display a price chart for a tokenized stock and read its live technicals. Use when the user wants to see or analyse a chart.",
    input_schema: { type: "object", properties: { symbol: { type: "string", description: "ticker, e.g. NVDA" }, range: { type: "string", enum: ["1m", "3m", "6m", "1y"], description: "default 6m" } }, required: ["symbol"] },
  },
  {
    name: "market_stats",
    description: "Get real technical stats (returns, RSI, volatility, Sharpe, drawdown, trend, regime) for one stock.",
    input_schema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] },
  },
  {
    name: "screen_market",
    description: "Screen the whole tokenized-equity universe by real technicals and return a ranked table. Use for 'what's strongest/oversold/best momentum' questions.",
    input_schema: { type: "object", properties: { trend: { type: "string", enum: ["up", "down", "flat", "any"] }, max_rsi: { type: "number" }, min_sharpe: { type: "number" }, sort: { type: "string", enum: ["return3m", "sharpe", "rsi14", "volAnnual"] }, limit: { type: "number" } } },
  },
  {
    name: "compare_stocks",
    description: "Compare 2-5 stocks side by side on their real technicals.",
    input_schema: { type: "object", properties: { symbols: { type: "array", items: { type: "string" } } }, required: ["symbols"] },
  },
  {
    name: "propose_swap",
    description: "Propose a swap for the user to review and sign (you NEVER execute). ANY token pair works — buy a stock with USDG *or ETH* (e.g. sellSym 'ETH', buySym 'NVDA'), or sell a stock back. The router finds the best route automatically, so NEVER tell the user there's 'no direct pool' or that they must swap to USDG first — just propose the exact swap they asked for. Only when the user wants to act.",
    input_schema: { type: "object", properties: { sellSym: { type: "string" }, buySym: { type: "string" }, sellAmount: { type: "string" }, rationale: { type: "string" } }, required: ["sellSym", "buySym", "sellAmount"] },
  },
  {
    name: "build_strategy",
    description: "Build a bounded, rules-based quant strategy the user can backtest, edit and export. Use for 'build/design a strategy' requests.",
    input_schema: { type: "object", properties: { name: { type: "string" }, mandate: { type: "string", enum: ["DCA", "Momentum", "Rotation", "Yield", "Hedge"] }, instruments: { type: "array", items: { type: "string" } }, summary: { type: "string" } }, required: ["name", "mandate", "instruments"] },
  },
  {
    name: "stock_news",
    description: "Get the latest real news headlines for a stock (or the market). Use for 'what's the news on X', catalysts, why a stock moved.",
    input_schema: { type: "object", properties: { symbol: { type: "string", description: "ticker, e.g. NVDA; omit for general market news" } } },
  },
  {
    name: "fundamentals",
    description: "Pull a company's real fundamentals from its latest SEC filing — revenue, net income, margin, EPS, assets, equity. Use for valuation/quality questions.",
    input_schema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] },
  },
  {
    name: "filings",
    description: "List a company's recent SEC filings (10-K/10-Q/8-K) and insider Form 4 activity, with links. Use for 'latest filing', 'insider buying/selling'.",
    input_schema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] },
  },
  {
    name: "market_pulse",
    description: "Snapshot of the broad market — S&P 500, Nasdaq, VIX, US 10Y yield, dollar index. Use for 'how's the market', risk-on/off, macro backdrop.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "token_onchain",
    description: "Live on-chain price, liquidity and 24h volume for a token on Robinhood Chain (by symbol or contract address). Use for $URI or any on-chain token.",
    input_schema: { type: "object", properties: { symbol: { type: "string", description: "e.g. URI, NVDA" }, address: { type: "string", description: "0x contract address (optional)" } } },
  },
  {
    name: "macro_calendar",
    description: "Current macro rate levels (Fed funds, CPI YoY, unemployment, 10Y) plus the upcoming high-impact US economic calendar (CPI, FOMC, jobs) with consensus forecasts. Use for macro/rates/CPI/Fed questions and 'what's on the calendar this week'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "analyst_ratings",
    description: "Wall Street analyst consensus for a stock — Strong Buy/Buy/Hold/Sell breakdown and how it's trending. Use for 'what do analysts think', rating, consensus questions.",
    input_schema: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] },
  },
  {
    name: "prediction_markets",
    description: "Real-money prediction-market odds from Polymarket — implied probabilities on events (Fed decisions, elections, macro, crypto, company outcomes). Use for 'what are the odds', 'will X happen', event probabilities the market is pricing.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "topic, e.g. 'fed rate cut', 'recession 2026', 'nvda'" } }, required: ["query"] },
  },
  {
    name: "generate_image",
    description: "Generate an image / picture / visual / meme from a text prompt, in Urizen's style. Use when the user asks to see, draw, make, or generate an image or visual.",
    input_schema: { type: "object", properties: { prompt: { type: "string", description: "what to depict" }, caption: { type: "string", description: "optional short caption/headline" } }, required: ["prompt"] },
  },
] as const;

const SORTS: Record<string, keyof Indicators> = { return3m: "return3m", sharpe: "sharpe", rsi14: "rsi14", volAnnual: "volAnnual" };

/** Execute a tool call and return text (for the model) + an optional artifact (for the UI). */
export async function executeTool(name: string, input: Record<string, unknown>): Promise<ToolOutcome> {
  const B = apiBase(); // "" on client, absolute on server (bot / x402)
  switch (name) {
    case "show_chart": {
      const symbol = String(input.symbol || "").replace(/^\$/, "").toUpperCase();
      const range = (input.range as string) || "6m";
      const data = await fetchOhlc(symbol, range);
      const ind = computeIndicators(data);
      return { text: `Chart shown for ${symbol} (${range}). ${statLine(ind)}`, artifact: { type: "chart", symbol, range, data, ind } };
    }
    case "market_stats": {
      const symbol = String(input.symbol || "").replace(/^\$/, "").toUpperCase();
      const data = await fetchOhlc(symbol, "6m");
      const ind = computeIndicators(data);
      return { text: statLine(ind), artifact: { type: "stats", symbol, name: nm(symbol), ind } };
    }
    case "screen_market": {
      const results = await Promise.all(
        STOCKS.map(async (s) => {
          try { return { symbol: s.symbol, name: s.name, ind: computeIndicators(await fetchOhlc(s.symbol, "3m")) }; }
          catch { return null; }
        }),
      );
      let rows = results.filter(Boolean) as { symbol: string; name: string; ind: Indicators }[];
      if (input.trend && input.trend !== "any") rows = rows.filter((r) => r.ind.trend === input.trend);
      if (typeof input.max_rsi === "number") rows = rows.filter((r) => r.ind.rsi14 <= (input.max_rsi as number));
      if (typeof input.min_sharpe === "number") rows = rows.filter((r) => r.ind.sharpe >= (input.min_sharpe as number));
      const key = SORTS[(input.sort as string) || "return3m"] ?? "return3m";
      rows.sort((a, b) => (b.ind[key] as number) - (a.ind[key] as number));
      const limit = Math.min(rows.length, (input.limit as number) || 8);
      rows = rows.slice(0, limit);
      const note = `${rows.length} match${rows.length === 1 ? "" : "es"}${input.trend && input.trend !== "any" ? ` · trend ${input.trend}` : ""}${typeof input.min_sharpe === "number" ? ` · Sharpe ≥ ${input.min_sharpe}` : ""}`;
      return { text: `Screen: ${note}. ${rows.map((r) => `${r.symbol} 3m ${pct(r.ind.return3m)} RSI ${r.ind.rsi14.toFixed(0)} Sharpe ${r.ind.sharpe.toFixed(2)}`).join("; ")}`, artifact: { type: "screen", rows, note } };
    }
    case "compare_stocks": {
      const syms = ((input.symbols as string[]) || []).map((s) => s.replace(/^\$/, "").toUpperCase()).slice(0, 5);
      const items = (await Promise.all(syms.map(async (s) => {
        try { return { symbol: s, name: nm(s), ind: computeIndicators(await fetchOhlc(s, "6m")) }; } catch { return null; }
      }))).filter(Boolean) as { symbol: string; name: string; ind: Indicators }[];
      return { text: items.map((i) => statLine(i.ind)).join("\n"), artifact: { type: "compare", items } };
    }
    case "propose_swap": {
      const proposal: SwapProposal = {
        sellSym: String(input.sellSym || "USDG").toUpperCase(),
        buySym: String(input.buySym || "NVDA").toUpperCase(),
        sellAmount: String(input.sellAmount || "100"),
        rationale: input.rationale ? String(input.rationale) : undefined,
      };
      return { text: `Proposed swap: ${proposal.sellAmount} ${proposal.sellSym} → ${proposal.buySym} (awaiting the user's signature).`, artifact: { type: "swap", proposal } };
    }
    case "build_strategy": {
      const mandate = (input.mandate as Mandate) || "Momentum";
      const instruments = ((input.instruments as string[]) || ["NVDA", "AAPL", "MSFT"]).map((s) => s.replace(/^\$/, "").toUpperCase());
      const config = defaultConfig(instruments, mandate);
      if (input.summary) config.summary = String(input.summary);
      const name = String(input.name || `${mandate} strategy`);
      return { text: `Built strategy "${name}" (${mandate}) over ${instruments.join(", ")} — shown with a backtest and export.`, artifact: { type: "strategy", name, mandate, config } };
    }
    case "stock_news": {
      const symbol = String(input.symbol || "").replace(/^\$/, "").toUpperCase();
      const q = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
      const r = await fetch(`${B}/api/quant/news${q}`);
      const d = await r.json() as { items?: NewsItem[] };
      const items = (d.items || []).slice(0, 12);
      const text = items.length
        ? `${symbol || "Market"} news:\n${items.slice(0, 6).map((n) => `- ${n.title} (${n.source})`).join("\n")}`
        : `No headlines found for ${symbol || "the market"}.`;
      return { text, artifact: { type: "news", symbol: symbol || "Market", items } };
    }
    case "fundamentals": {
      const symbol = String(input.symbol || "").replace(/^\$/, "").toUpperCase();
      const r = await fetch(`${B}/api/quant/fundamentals?symbol=${encodeURIComponent(symbol)}`);
      const d = await r.json() as { symbol?: string; name?: string; latest?: Fundamentals; available?: boolean; note?: string };
      if (d.available === false || !d.latest) return { text: `${symbol}: ${d.note || "no SEC fundamentals available"}.`, artifact: { type: "fundamentals", symbol, name: d.name || nm(symbol), latest: null, available: false, note: d.note } };
      const f = d.latest;
      const bn = (x: number | null) => (x == null ? "—" : x >= 1e9 ? `$${(x / 1e9).toFixed(1)}B` : x >= 1e6 ? `$${(x / 1e6).toFixed(1)}M` : `$${x.toFixed(0)}`);
      const text = `${symbol} FY${f.fiscalYear} (SEC): revenue ${bn(f.revenue)}, net income ${bn(f.netIncome)}, net margin ${f.netMargin != null ? (f.netMargin * 100).toFixed(1) + "%" : "—"}, diluted EPS ${f.eps != null ? "$" + f.eps.toFixed(2) : "—"}, assets ${bn(f.assets)}, equity ${bn(f.equity)}.`;
      return { text, artifact: { type: "fundamentals", symbol, name: d.name || nm(symbol), latest: f, available: true } };
    }
    case "filings": {
      const symbol = String(input.symbol || "").replace(/^\$/, "").toUpperCase();
      const r = await fetch(`${B}/api/quant/filings?symbol=${encodeURIComponent(symbol)}`);
      const d = await r.json() as { symbol?: string; name?: string; filings?: Filing[]; insiderRecentCount?: number; available?: boolean; note?: string };
      if (d.available === false || !d.filings?.length) return { text: `${symbol}: ${d.note || "no SEC filings available"}.`, artifact: { type: "filings", symbol, name: d.name || nm(symbol), filings: [], insiderRecentCount: 0, available: false, note: d.note } };
      const text = `${symbol} recent filings: ${d.filings.slice(0, 6).map((f) => `${f.form} ${f.date}`).join("; ")}. Insider Form 4s recently: ${d.insiderRecentCount ?? 0}.`;
      return { text, artifact: { type: "filings", symbol, name: d.name || nm(symbol), filings: d.filings, insiderRecentCount: d.insiderRecentCount ?? 0, available: true } };
    }
    case "market_pulse": {
      const r = await fetch(`${B}/api/quant/market`);
      const d = await r.json() as { items?: MarketItem[] };
      const items = d.items || [];
      const text = items.length
        ? `Market pulse: ${items.map((m) => `${m.label} ${m.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${m.changePct >= 0 ? "+" : ""}${m.changePct.toFixed(2)}%)`).join(" · ")}`
        : "Market data unavailable right now.";
      return { text, artifact: { type: "market", items } };
    }
    case "token_onchain": {
      const symbol = String(input.symbol || "").replace(/^\$/, "").toUpperCase();
      const address = String(input.address || "");
      const q = address ? `?address=${encodeURIComponent(address)}` : `?symbol=${encodeURIComponent(symbol || "URI")}`;
      const r = await fetch(`${B}/api/quant/onchain${q}`);
      const d = await r.json() as OnchainData;
      const text = d.priceUsd != null
        ? `${d.symbol || symbol} on-chain: $${d.priceUsd < 0.01 ? d.priceUsd.toPrecision(3) : d.priceUsd.toFixed(4)}, liquidity ${d.liquidityUsd != null ? "$" + Math.round(d.liquidityUsd).toLocaleString() : "—"}, 24h vol ${d.volume24h != null ? "$" + Math.round(d.volume24h).toLocaleString() : "—"}, 24h ${d.priceChange24h != null ? (d.priceChange24h >= 0 ? "+" : "") + d.priceChange24h.toFixed(1) + "%" : "—"}.`
        : `${d.symbol || symbol}: ${d.note || "no on-chain pool indexed yet"}.`;
      return { text, artifact: { type: "onchain", data: { ...d, symbol: d.symbol || symbol } } };
    }
    case "macro_calendar": {
      const r = await fetch(`${B}/api/quant/macro`);
      const d = await r.json() as { rates?: MacroRate[]; calendar?: MacroEvent[] };
      const rates = d.rates || [];
      const cal = d.calendar || [];
      const upcoming = cal.filter((e) => !e.actual).slice(0, 4);
      const text = `Macro levels: ${rates.map((x) => `${x.label} ${x.value}`).join(" · ") || "unavailable"}. Upcoming (consensus): ${upcoming.map((e) => `${e.title}${e.forecast ? ` ${e.forecast}` : ""} [${e.impact}]`).join("; ") || "nothing scheduled"}.`;
      return { text, artifact: { type: "macro", rates, calendar: cal } };
    }
    case "analyst_ratings": {
      const symbol = String(input.symbol || "").replace(/^\$/, "").toUpperCase();
      const r = await fetch(`${B}/api/quant/ratings?symbol=${encodeURIComponent(symbol)}`);
      const d = await r.json() as { available?: boolean; consensus?: string; score?: number; analysts?: number; trend?: RatingTrend[]; note?: string };
      if (!d.available) return { text: `${symbol}: ${d.note || "no analyst ratings available"}.`, artifact: { type: "ratings", symbol, name: nm(symbol), available: false, note: d.note } };
      const t = d.trend?.[0];
      const text = `${symbol} analyst consensus: ${d.consensus} (${d.analysts} analysts${t ? `: ${t.strongBuy} strong buy, ${t.buy} buy, ${t.hold} hold, ${t.sell} sell, ${t.strongSell} strong sell` : ""}).`;
      return { text, artifact: { type: "ratings", symbol, name: nm(symbol), available: true, consensus: d.consensus, score: d.score, analysts: d.analysts, trend: d.trend } };
    }
    case "prediction_markets": {
      const query = String(input.query || "").trim();
      const r = await fetch(`${B}/api/quant/predictions?q=${encodeURIComponent(query)}`);
      const d = await r.json() as { markets?: PredictionMarket[] };
      const markets = d.markets || [];
      const text = markets.length
        ? `Polymarket on "${query}":\n${markets.slice(0, 5).map((m) => `- ${m.question} → ${m.outcome ?? "?"} ${m.probability != null ? Math.round(m.probability * 100) + "%" : ""}`).join("\n")}`
        : `No prediction markets found for "${query}".`;
      return { text, artifact: { type: "predictions", query, markets } };
    }
    case "generate_image": {
      const prompt = String(input.prompt || "").slice(0, 300);
      const caption = String(input.caption || prompt).slice(0, 120);
      // the always-available branded card; the bot upgrades to an AI image when a key is set
      const url = cardUrl(B, { tag: "URIZEN", title: caption });
      return { text: `Generated an image for: ${prompt}`, artifact: { type: "image", prompt, url } };
    }
    default:
      return { text: `unknown tool ${name}` };
  }
}
