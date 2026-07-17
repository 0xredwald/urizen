// The Urizen Alpha skill registry — one source of truth for the tools the agent can use.
// Drives BOTH the Skills tab (toggle what the agent may call) and the "/" command menu in the
// composer. Each id matches a tool name in ALPHA_TOOLS (or the built-in "web_search").

import type { Icon } from "@tabler/icons-react";
import {
  IconChartLine, IconGauge, IconFilterSearch, IconArrowsDiff,
  IconReportMoney, IconFileDollar, IconNews, IconChartArcs, IconCoin,
  IconWorldSearch, IconArrowsExchange, IconBinaryTree2, IconCalendarStats,
  IconStars, IconChartBar,
} from "@tabler/icons-react";

export type SkillGroup = "Research" | "Fundamentals" | "Market" | "Act";

export type Skill = {
  id: string;                 // tool name (ALPHA_TOOLS) or "web_search"
  command: string;            // slash trigger, e.g. "/chart"
  label: string;
  desc: string;
  group: SkillGroup;
  icon: Icon;
  arg?: string;               // placeholder shown after the command, e.g. "NVDA"
  prompt: (arg: string) => string; // message sent when launched from the "/" menu
};

export const SKILLS: Skill[] = [
  // ── Research (real OHLC technicals) ──
  { id: "show_chart", command: "/chart", label: "Chart", desc: "Price chart + live technicals", group: "Research", icon: IconChartLine, arg: "NVDA",
    prompt: (a) => `Show the ${a || "NVDA"} chart and read its technicals.` },
  { id: "market_stats", command: "/stats", label: "Technicals", desc: "RSI, volatility, Sharpe, drawdown, trend", group: "Research", icon: IconGauge, arg: "NVDA",
    prompt: (a) => `Give me the full technical read on ${a || "NVDA"}.` },
  { id: "screen_market", command: "/screen", label: "Screener", desc: "Rank the whole universe by technicals", group: "Research", icon: IconFilterSearch,
    prompt: (a) => a ? `Screen the tokenized-stock universe: ${a}.` : `Screen the tokenized-stock universe for the strongest setups right now.` },
  { id: "compare_stocks", command: "/compare", label: "Compare", desc: "Two or more stocks side by side", group: "Research", icon: IconArrowsDiff, arg: "NVDA AMD",
    prompt: (a) => `Compare ${a || "NVDA and AMD"} on their technicals.` },

  // ── Fundamentals (SEC filings + news) ──
  { id: "fundamentals", command: "/fundamentals", label: "Fundamentals", desc: "Revenue, margins, EPS from SEC filings", group: "Fundamentals", icon: IconReportMoney, arg: "NVDA",
    prompt: (a) => `Pull ${a || "NVDA"}'s latest fundamentals from its SEC filings.` },
  { id: "filings", command: "/filings", label: "Filings & insiders", desc: "Recent 10-K/10-Q/8-K + insider Form 4", group: "Fundamentals", icon: IconFileDollar, arg: "NVDA",
    prompt: (a) => `Show ${a || "NVDA"}'s recent SEC filings and insider activity.` },
  { id: "analyst_ratings", command: "/ratings", label: "Analyst ratings", desc: "Wall Street consensus — buy/hold/sell", group: "Fundamentals", icon: IconStars, arg: "NVDA",
    prompt: (a) => `What's the analyst consensus on ${a || "NVDA"}?` },
  { id: "stock_news", command: "/news", label: "News", desc: "Latest headlines for a stock", group: "Fundamentals", icon: IconNews, arg: "NVDA",
    prompt: (a) => `What's the latest news on ${a || "NVDA"}?` },

  // ── Market (macro pulse, on-chain, web) ──
  { id: "market_pulse", command: "/market", label: "Market pulse", desc: "S&P, Nasdaq, VIX, 10Y, dollar", group: "Market", icon: IconChartArcs,
    prompt: () => `Give me the market pulse — indices, VIX and rates.` },
  { id: "token_onchain", command: "/onchain", label: "On-chain", desc: "Live price & liquidity on Robinhood Chain", group: "Market", icon: IconCoin, arg: "URI",
    prompt: (a) => `Show the on-chain price and liquidity for ${a || "URI"}.` },
  { id: "macro_calendar", command: "/macro", label: "Macro & calendar", desc: "Fed funds, CPI, jobs + this week's economic events", group: "Market", icon: IconCalendarStats,
    prompt: () => `Show the macro picture — rates, CPI, and this week's economic calendar.` },
  { id: "prediction_markets", command: "/odds", label: "Prediction markets", desc: "Polymarket real-money odds on events", group: "Market", icon: IconChartBar, arg: "fed rate cut",
    prompt: (a) => `What are the Polymarket odds on ${a || "the next Fed decision"}?` },
  { id: "web_search", command: "/search", label: "Web search", desc: "Search the web for anything", group: "Market", icon: IconWorldSearch, arg: "query",
    prompt: (a) => a ? `Search the web: ${a}` : `Search the web for the latest market-moving news.` },

  // ── Act (non-custodial; the user signs) ──
  { id: "propose_swap", command: "/swap", label: "Swap", desc: "Propose a non-custodial swap to sign", group: "Act", icon: IconArrowsExchange, arg: "100 USDG to NVDA",
    prompt: (a) => `Propose a swap: ${a || "100 USDG into NVDA"}.` },
  { id: "build_strategy", command: "/strategy", label: "Strategy", desc: "Build a backtestable rules-based strategy", group: "Act", icon: IconBinaryTree2, arg: "momentum NVDA AAPL",
    prompt: (a) => `Build a strategy: ${a || "momentum on NVDA and AAPL"}.` },
];

export const SKILL_GROUPS: SkillGroup[] = ["Research", "Fundamentals", "Market", "Act"];
export const ALL_SKILL_IDS = SKILLS.map((s) => s.id);
export const skillById = (id: string) => SKILLS.find((s) => s.id === id);
