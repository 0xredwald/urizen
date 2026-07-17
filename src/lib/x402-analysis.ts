// Urizen's multi-agent equity-analysis engine — the product behind the x402 endpoint. It gathers
// real data from the whole desk (technicals, SEC fundamentals + filings, analyst ratings, news,
// macro, prediction markets, on-chain), then has LLM specialists reason over it and a portfolio
// manager synthesize a call. Deterministic data in, real analysis out. Priced by depth.

import { apiBase } from "./api-base";
import { fetchOhlc, computeIndicators, type Indicators } from "./quant";
import { bySymbol } from "./stocks";

// x402 runs on its own key + (optionally) its own provider. Set X402_LLM_BASE_URL to any
// OpenAI-compatible endpoint (e.g. Surplus Intelligence's open inference market) + X402_OPENROUTER_KEY
// to that provider's key, and the paid agents run there. Defaults to OpenRouter with the free key.
const LLM_BASE = (process.env.X402_LLM_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
const OPENROUTER = `${LLM_BASE}/chat/completions`;
const CUSTOM_PROVIDER = !!process.env.X402_LLM_BASE_URL;

export type Depth = "snapshot" | "standard" | "deep";
// Price per call in USDC, by depth — set to the x402 market for analysis (raw-data calls are
// ~$0.003, single "analysis" calls ~$0.10, full research briefs $2-10). We're the only multi-source
// synthesized equity thesis, so we price at the analysis/brief tier; real inference cost is a fraction
// of a cent on cheap models, so margins are enormous. Snapshot is a hook; deep runs the 4-agent panel.
export const PRICES: Record<Depth, string> = { snapshot: "$0.01", standard: "$0.10", deep: "$0.50" };

// Default to a free model so the endpoint works with our free-tier key out of the box; the operator
// sets X402_MODEL / X402_SYNTH_MODEL to stronger paid models (their choice) once the key has credits.
const model = () => process.env.X402_MODEL || "openai/gpt-oss-20b:free";
const synthModel = () => process.env.X402_SYNTH_MODEL || model();

const FREE_FALLBACK = ["openai/gpt-oss-20b:free", "qwen/qwen3-next-80b-a3b-instruct:free", "nvidia/nemotron-3-super-120b-a12b:free"];

// Token safety: every LLM call is bounded. Output is capped per call (X402_MAX_TOKENS, hard ceiling
// 1200 so env can't set it absurdly high) and the input is truncated — so a paid call can never spend
// materially more inference than its tier's price. A deep call is a fixed 5 calls (4 agents + PM);
// there is no loop, so total tokens per request are strictly bounded.
const MAX_OUT = Math.min(Number(process.env.X402_MAX_TOKENS) || 700, 1200);
const MAX_IN_CHARS = 6000;

async function llm(system: string, user: string, useModel = model()): Promise<string> {
  const key = process.env.X402_OPENROUTER_KEY || process.env.URIZEN_FREE_OPENROUTER_KEY;
  if (!key) throw new Error("analysis model not configured");
  // on a custom provider (e.g. Surplus Intelligence) only the chosen model applies; the free
  // fallbacks are OpenRouter-specific, so skip them there.
  const models = CUSTOM_PROVIDER ? [useModel] : [useModel, ...FREE_FALLBACK.filter((m) => m !== useModel)];
  const capped = user.length > MAX_IN_CHARS ? user.slice(0, MAX_IN_CHARS) : user;
  for (const m of models) {
    try {
      const res = await fetch(OPENROUTER, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "http-referer": "https://urizenfund.com", "x-title": "Urizen x402 Analysis" },
        body: JSON.stringify({ model: m, messages: [{ role: "system", content: system }, { role: "user", content: capped }], max_tokens: MAX_OUT, temperature: 0.4 }),
      });
      if (res.ok) { const d = await res.json(); const txt = (d?.choices?.[0]?.message?.content || "").trim(); if (txt) return txt; }
    } catch { /* next model */ }
  }
  throw new Error("all analysis models unavailable");
}

const j = async (url: string) => { try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; } };
const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;

// Compact, model-friendly renderings of each data source.
function techLine(i: Indicators): string {
  return `price $${i.price.toFixed(2)}, 1d ${pct(i.change1d)}, 1m ${pct(i.return1m)}, 3m ${pct(i.return3m)}, 6m ${pct(i.return6m)}; RSI ${i.rsi14.toFixed(0)}, annVol ${(i.volAnnual * 100).toFixed(0)}%, Sharpe ${i.sharpe.toFixed(2)}, maxDD ${(i.maxDrawdown * 100).toFixed(0)}%, trend ${i.trend}, regime ${i.regime}`;
}
function fundLine(f: { latest?: { fiscalYear: number; revenue: number | null; netIncome: number | null; netMargin: number | null; eps: number | null }; available?: boolean } | null): string {
  const l = f?.latest;
  // the route returns `latest` on success (no `available:true`); only `available:false` means no filer
  if (f?.available === false || !l) return "no SEC fundamentals (ETF or private)";
  const bn = (x: number | null) => (x == null ? "—" : x >= 1e9 ? `$${(x / 1e9).toFixed(1)}B` : `$${(x / 1e6).toFixed(0)}M`);
  return `FY${l.fiscalYear}: revenue ${bn(l.revenue)}, net income ${bn(l.netIncome)}, net margin ${l.netMargin != null ? (l.netMargin * 100).toFixed(1) + "%" : "—"}, diluted EPS ${l.eps != null ? "$" + l.eps.toFixed(2) : "—"}`;
}
function ratingsLine(r: { available?: boolean; consensus?: string; analysts?: number; trend?: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }[] } | null): string {
  if (!r?.available || !r.trend?.[0]) return "no analyst coverage";
  const t = r.trend[0];
  return `consensus ${r.consensus} across ${r.analysts} analysts (${t.strongBuy} strong buy, ${t.buy} buy, ${t.hold} hold, ${t.sell} sell, ${t.strongSell} strong sell)`;
}
function newsLines(n: { items?: { title: string; source: string }[] } | null): string {
  const items = n?.items || [];
  return items.length ? items.slice(0, 6).map((x) => `- ${x.title} (${x.source})`).join("\n") : "no recent headlines";
}
function macroLine(m: { rates?: { label: string; value: string }[]; calendar?: { title: string; forecast: string | null; impact: string }[] } | null): string {
  const rates = (m?.rates || []).map((r) => `${r.label} ${r.value}`).join(", ");
  const cal = (m?.calendar || []).filter((e) => !("actual" in e) || true).slice(0, 4).map((e) => `${e.title}${e.forecast ? ` (est ${e.forecast})` : ""}`).join("; ");
  return `${rates || "—"}. Upcoming: ${cal || "nothing major"}`;
}
function predLines(p: { markets?: { question: string; outcome: string | null; probability: number | null }[] } | null): string {
  const ms = p?.markets || [];
  return ms.length ? ms.slice(0, 4).map((x) => `- ${x.question}: ${x.outcome ?? "?"} ${x.probability != null ? Math.round(x.probability * 100) + "%" : ""}`).join("\n") : "no relevant prediction markets";
}

export type AnalysisReport = {
  ticker: string;
  name: string;
  depth: Depth;
  generatedAt: string;
  data: {
    technicals: string;
    fundamentals: string;
    ratings: string;
    news: string;
    macro: string;
    predictions: string;
    onchainUsd: number | null;
  };
  agents?: { technical?: string; fundamental?: string; macro?: string; flow?: string };
  thesis: string;
  disclaimer: string;
};

export async function analyzeStock(rawTicker: string, depth: Depth, stampIso: string): Promise<AnalysisReport> {
  const ticker = rawTicker.replace(/^\$/, "").toUpperCase();
  const name = bySymbol(ticker)?.name ?? ticker;
  const B = apiBase();

  // gather the whole desk in parallel (deterministic, no model)
  const [ohlc, fund, ratings, news, preds, onchain, macro] = await Promise.all([
    fetchOhlc(ticker, "6m").catch(() => null),
    j(`${B}/api/quant/fundamentals?symbol=${encodeURIComponent(ticker)}`),
    j(`${B}/api/quant/ratings?symbol=${encodeURIComponent(ticker)}`),
    j(`${B}/api/quant/news?symbol=${encodeURIComponent(ticker)}`),
    j(`${B}/api/quant/predictions?q=${encodeURIComponent(name + " stock")}`),
    j(`${B}/api/quant/onchain?symbol=${encodeURIComponent(ticker)}`),
    j(`${B}/api/quant/macro`),
  ]);
  const ind = ohlc && ohlc.candles?.length ? computeIndicators(ohlc) : null;

  const data = {
    technicals: ind ? techLine(ind) : "no price data",
    fundamentals: fundLine(fund),
    ratings: ratingsLine(ratings),
    news: newsLines(news),
    macro: macroLine(macro),
    predictions: predLines(preds),
    onchainUsd: onchain?.priceUsd ?? null,
  };

  const dataBlock =
    `TICKER: ${ticker} (${name})\n` +
    `TECHNICALS: ${data.technicals}\n` +
    `FUNDAMENTALS (SEC): ${data.fundamentals}\n` +
    `ANALYST RATINGS: ${data.ratings}\n` +
    `MACRO BACKDROP: ${data.macro}\n` +
    `PREDICTION MARKETS: \n${data.predictions}\n` +
    `RECENT NEWS:\n${data.news}`;

  const disclaimer = "Synthesized from real data by Urizen. Speculative; can lose value. Not investment advice.";

  // — snapshot: one tight take —
  if (depth === "snapshot") {
    const thesis = await llm(
      "You are a sharp buy-side analyst. In 3-4 sentences, give a clear read on the stock from the data: the setup, the one thing that matters most, and a directional lean (bullish/neutral/bearish) with conviction. No hedging boilerplate.",
      dataBlock,
    );
    return { ticker, name, depth, generatedAt: stampIso, data, thesis, disclaimer };
  }

  // — standard: one structured thesis over everything —
  if (depth === "standard") {
    const thesis = await llm(
      "You are a buy-side analyst writing a concise research note. Using ONLY the data provided, produce: (1) THESIS — a one-line call (Bullish/Neutral/Bearish) + conviction; (2) WHAT'S WORKING — 2-3 bullets; (3) RISKS — 2-3 bullets; (4) CATALYSTS — what to watch, tie in macro/prediction-market odds where relevant. Be specific with the numbers. No generic disclaimers in the body.",
      dataBlock,
    );
    return { ticker, name, depth, generatedAt: stampIso, data, thesis, disclaimer };
  }

  // — deep: a 4-analyst panel over the whole desk + a PM synthesis —
  const [technical, fundamental, macroTake, flow] = await Promise.all([
    llm("You are a technical analyst. From the technicals, read trend, momentum, volatility regime, key risk levels and what the tape is saying. 3-4 sentences, specific.", `TECHNICALS for ${ticker}: ${data.technicals}`),
    llm("You are a fundamental analyst. From the SEC fundamentals and analyst consensus, assess quality, growth, margins and how the Street is positioned. 3-4 sentences. If it's an ETF/no filings, say so and pivot to what the wrapper tracks.", `FUNDAMENTALS: ${data.fundamentals}\nANALYST RATINGS: ${data.ratings}`),
    llm("You are a macro & catalyst strategist. From the macro backdrop and prediction-market odds, identify the top external drivers and near-term dated catalysts for this name, with the odds where they matter. 3-4 sentences.", `MACRO: ${data.macro}\nPREDICTION MARKETS:\n${data.predictions}`),
    llm("You are a news-flow & on-chain analyst. From the recent headlines and the on-chain price, read the narrative, sentiment and any flow/liquidity signal on the tokenized version. 3-4 sentences.", `RECENT NEWS:\n${data.news}\nON-CHAIN PRICE (USD): ${data.onchainUsd ?? "n/a"}`),
  ]);

  const thesis = await llm(
    "You are the portfolio manager. Four of your analysts gave the reads below. Synthesize into a decisive note: (1) CALL — Bullish/Neutral/Bearish + conviction (low/med/high) + a rough time horizon; (2) THE CASE — the 2-3 strongest points across the analysts; (3) THE BEAR CASE — the strongest counter; (4) WHAT WOULD CHANGE YOUR MIND — 1-2 measurable triggers. Reconcile disagreement between the analysts explicitly. Decisive, specific, no boilerplate.",
    `TICKER: ${ticker} (${name})\n\nTECHNICAL ANALYST:\n${technical}\n\nFUNDAMENTAL ANALYST:\n${fundamental}\n\nMACRO & CATALYST STRATEGIST:\n${macroTake}\n\nNEWS-FLOW & ON-CHAIN ANALYST:\n${flow}`,
    synthModel(),
  );

  return { ticker, name, depth, generatedAt: stampIso, data, agents: { technical, fundamental, macro: macroTake, flow }, thesis, disclaimer };
}
