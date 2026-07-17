// Horizon — the terminal agent. It reasons over REAL candles/indicators and returns a short spoken
// line plus a list of terminal ACTIONS (select a symbol, set a timeframe, add an indicator, draw a
// trendline/level/marker, check news, propose a trade). The client dispatches each action and moves
// a visible cursor so you watch it work. Browser BYOK (key → provider directly) or Free Mode
// (server proxy /api/alpha/free). JSON-action protocol so it works on any model, including free ones.

import type { Candle, Indicators } from "./quant";
import { getActiveBinding, FREE_MODEL } from "./agents";

export type HAction =
  | { tool: "selectSymbol"; symbol: string }
  | { tool: "openChart"; symbol: string }
  | { tool: "setTimeframe"; range: "1m" | "3m" | "6m" | "1y" }
  | { tool: "addIndicator"; name: "MA" | "EMA" | "BOLL" | "RSI" | "MACD" | "KDJ" | "VOL" }
  | { tool: "clearIndicators" }
  | { tool: "drawTrendline"; from: { t: number; price: number }; to: { t: number; price: number }; label?: string }
  | { tool: "drawHLine"; price: number; label?: string }
  | { tool: "marker"; t: number; price: number; text: string }
  | { tool: "clearDrawings" }
  | { tool: "checkNews"; symbol?: string }
  | { tool: "proposeTrade"; side: "buy" | "sell"; symbol: string; amount: number };

export type HorizonReply = { say: string; actions: HAction[] };
export type HorizonCtx = { symbol: string; range: string; candles: Candle[]; indicators?: Indicators | null; universe: string[] };
export type HMsg = { role: "user" | "assistant"; content: string };

const MODEL_FALLBACK: Record<string, string> = { anthropic: "claude-sonnet-5", openrouter: "anthropic/claude-sonnet-5" };

function systemPrompt(ctx: HorizonCtx): string {
  return [
    "You are Horizon, an equity analyst operating a Bloomberg-style trading terminal. You don't just talk — you OPERATE the terminal through tools, and the user watches your cursor draw.",
    "Reason over the REAL candles and indicators given. NEVER invent prices, timestamps, or stats. This is not investment advice.",
    "",
    "Respond with ONLY minified JSON (no markdown fences):",
    `{"say": string (1-3 crisp sentences, lowercase-ok, what you see + what you're doing), "actions": HAction[]}`,
    "HAction is one of:",
    `{"tool":"selectSymbol","symbol":"TSLA"} (retarget the active chart) · {"tool":"openChart","symbol":"TSLA"} (open a NEW chart, up to 4 — a playground) · {"tool":"setTimeframe","range":"1m|3m|6m|1y"}`,
    `{"tool":"addIndicator","name":"MA|EMA|BOLL|RSI|MACD|KDJ|VOL"} · {"tool":"clearIndicators"}`,
    `{"tool":"drawTrendline","from":{"t":<unix_sec>,"price":<n>},"to":{"t":<unix_sec>,"price":<n>},"label":"uptrend"}`,
    `{"tool":"drawHLine","price":<n>,"label":"support"} · {"tool":"marker","t":<unix_sec>,"price":<n>,"text":"breakout"}`,
    `{"tool":"clearDrawings"} · {"tool":"checkNews","symbol":"NVDA"} · {"tool":"proposeTrade","side":"buy|sell","symbol":"NVDA","amount":<usd>}`,
    "",
    "RULES:",
    "- For drawTrendline/marker, `t` MUST be a timestamp that appears in the CANDLES below, and `price` a real level from the data (a swing high/low, a close). Connect two real pivots for a trendline.",
    "- For drawHLine (support/resistance), use a real level from recent highs/lows.",
    "- Sequence sensibly: selectSymbol / setTimeframe first if needed, then indicators, then drawings.",
    "- Only proposeTrade when the user clearly wants to act. Keep actions to what the request needs (1-5).",
    `- Symbols available: ${ctx.universe.join(", ")}.`,
  ].join("\n");
}

function grounding(ctx: HorizonCtx, userText: string): string {
  const c = ctx.candles;
  const tail = c.slice(-46);
  const hi = c.reduce((a, k) => (k.h > a.h ? k : a), c[0]);
  const lo = c.reduce((a, k) => (k.l < a.l ? k : a), c[0]);
  const ind = ctx.indicators;
  const indLine = ind
    ? `price $${ind.price.toFixed(2)}, 1d ${(ind.change1d * 100).toFixed(1)}%, RSI ${ind.rsi14.toFixed(0)}, SMA20 ${ind.sma20.toFixed(2)}, SMA50 ${ind.sma50.toFixed(2)}, annVol ${(ind.volAnnual * 100).toFixed(0)}%, trend ${ind.trend}, regime ${ind.regime}`
    : "n/a";
  const rows = tail.map((k) => `${k.t}|${k.o.toFixed(2)}|${k.h.toFixed(2)}|${k.l.toFixed(2)}|${k.c.toFixed(2)}`).join("\n");
  return [
    `CHART: ${ctx.symbol} · ${ctx.range} · daily candles`,
    `INDICATORS: ${indLine}`,
    `SWING HIGH: $${hi.h.toFixed(2)} @ t=${hi.t}  ·  SWING LOW: $${lo.l.toFixed(2)} @ t=${lo.t}`,
    `CANDLES (t=unix_sec | o|h|l|c), oldest→newest:`,
    rows,
    "",
    `USER: ${userText}`,
  ].join("\n");
}

async function readSSE(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const dec = new TextDecoder();
  let buf = "", out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") continue;
      try { out += JSON.parse(data)?.choices?.[0]?.delta?.content || ""; } catch { /* skip */ }
    }
  }
  return out;
}

export async function runHorizon(userText: string, ctx: HorizonCtx, history: HMsg[]): Promise<HorizonReply> {
  const binding = getActiveBinding();
  if (!binding) throw new Error("no model available");
  const system = systemPrompt(ctx);
  const prior = history.slice(-6).map((m) => ({ role: m.role, content: m.content }));
  const user = grounding(ctx, userText);
  let raw = "";

  if (binding.free || !binding.key) {
    // Free Mode → same-origin server proxy (streams SSE)
    const res = await fetch("/api/alpha/free", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: binding.model || FREE_MODEL, max_tokens: 1200, messages: [{ role: "system", content: system }, ...prior, { role: "user", content: user }] }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `free mode ${res.status}`); }
    raw = await readSSE(res);
  } else if (binding.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": binding.key.trim(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: binding.model || MODEL_FALLBACK.anthropic, max_tokens: 1200, system, messages: [...prior, { role: "user", content: user }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `anthropic ${res.status}`);
    raw = data.content?.map((b: { text?: string }) => b.text || "").join("") ?? "";
  } else {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${binding.key.trim()}`, "http-referer": "https://urizenfund.com", "x-title": "URIZEN Terminal · Horizon" },
      body: JSON.stringify({ model: binding.model || MODEL_FALLBACK.openrouter, max_tokens: 1200, messages: [{ role: "system", content: system }, ...prior, { role: "user", content: user }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `openrouter ${res.status}`);
    raw = data.choices?.[0]?.message?.content ?? "";
  }

  return parse(raw);
}

function parse(text: string): HorizonReply {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const s = body.indexOf("{"), e = body.lastIndexOf("}");
  if (s === -1 || e === -1) return { say: text.trim() || "…", actions: [] };
  try {
    const obj = JSON.parse(body.slice(s, e + 1));
    const actions = Array.isArray(obj.actions) ? obj.actions.filter((a: HAction) => a && typeof a.tool === "string") : [];
    return { say: String(obj.say ?? text.trim() ?? "").slice(0, 600), actions };
  } catch {
    return { say: text.trim().slice(0, 600) || "…", actions: [] };
  }
}
