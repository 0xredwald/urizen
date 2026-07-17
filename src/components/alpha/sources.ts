// Research SOURCES the agent can pull from — surfaced as "@" mentions in the composer.
// Distinct from Skills (the "/" tools): an "@source" scopes a single question to the data the
// user wants consulted. Each maps to one or more tool ids that get enabled for that turn.

import type { Icon } from "@tabler/icons-react";
import {
  IconWorldSearch, IconNews, IconBuildingBank, IconCalendarStats,
  IconChartArcs, IconCoin, IconStars, IconChartBar,
} from "@tabler/icons-react";

export type Source = {
  id: string;         // unique
  command: string;    // the "@" mention, e.g. "@sec"
  label: string;
  desc: string;
  icon: Icon;         // fallback when no brand logo
  logo?: string;      // brand logo (served from /public)
  tools: string[];    // tool ids to prioritise this turn
};

const L = (f: string) => `/logos/sources/${f}`;

export const SOURCES: Source[] = [
  { id: "web", command: "@web", label: "Web", desc: "Live web search — anything, anywhere", icon: IconWorldSearch, tools: ["web_search"] },
  { id: "news", command: "@news", label: "News", desc: "Financial headlines (Yahoo/Google)", icon: IconNews, logo: L("yahoo.png"), tools: ["stock_news"] },
  { id: "sec", command: "@sec", label: "SEC filings", desc: "EDGAR fundamentals + filings + insiders", icon: IconBuildingBank, logo: L("sec.png"), tools: ["fundamentals", "filings"] },
  { id: "ratings", command: "@ratings", label: "Analysts", desc: "Wall Street consensus (Finnhub)", icon: IconStars, logo: L("finnhub.webp"), tools: ["analyst_ratings"] },
  { id: "macro", command: "@macro", label: "Macro", desc: "Fed/CPI/jobs + economic calendar", icon: IconCalendarStats, logo: L("fed.ico"), tools: ["macro_calendar"] },
  { id: "market", command: "@market", label: "Market", desc: "Indices, VIX, rates snapshot", icon: IconChartArcs, logo: L("yahoo.png"), tools: ["market_pulse"] },
  { id: "onchain", command: "@onchain", label: "On-chain", desc: "Robinhood Chain price & liquidity", icon: IconCoin, logo: L("dexscreener.png"), tools: ["token_onchain"] },
  { id: "polymarket", command: "@polymarket", label: "Polymarket", desc: "Real-money prediction-market odds", icon: IconChartBar, logo: L("polymarket.png"), tools: ["prediction_markets"] },
];

export const sourceByCommand = (cmd: string) => SOURCES.find((s) => s.command.toLowerCase() === cmd.toLowerCase());

// Sources @-mentioned in a message → the tool ids to enable + their labels (for a hint).
export function parseSources(text: string): { toolIds: string[]; labels: string[] } {
  const toolIds = new Set<string>();
  const labels: string[] = [];
  for (const s of SOURCES) {
    if (new RegExp(`(?:^|\\s)${s.command}(?=\\s|$)`, "i").test(text)) {
      s.tools.forEach((t) => toolIds.add(t));
      labels.push(s.label);
    }
  }
  return { toolIds: [...toolIds], labels };
}

// The "@…" token currently being typed at the end of the input (for the live menu).
export function matchAt(input: string): Source[] {
  const m = input.match(/(?:^|\s)@(\w*)$/);
  if (m == null) return [];
  const term = m[1].toLowerCase();
  return SOURCES.filter((s) => s.command.slice(1).toLowerCase().startsWith(term) || s.label.toLowerCase().includes(term));
}
