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
  | { tool: "setTimeframe"; range: "1m" | "5m" | "15m" | "1h" | "1D" | "1W" }
  | { tool: "addIndicator"; name: "MA" | "EMA" | "BOLL" | "RSI" | "MACD" | "KDJ" | "VOL" }
  | { tool: "clearIndicators" }
  | { tool: "drawTrendline"; from: { t: number; price: number }; to: { t: number; price: number }; label?: string }
  | { tool: "drawHLine"; price: number; label?: string }
  | { tool: "marker"; t: number; price: number; text: string }
  | { tool: "clearDrawings" }
  | { tool: "checkNews"; symbol?: string }
  | { tool: "openPanel"; panel: string }
  | { tool: "closePanel"; panel: string }
  | { tool: "proposeTrade"; side: "buy" | "sell"; symbol: string; amount: number };

export type HorizonReply = { say: string; actions: HAction[] };
export type Persona = { name: string; mandate?: string; risk?: string; note?: string };
export type HorizonCtx = { symbol: string; range: string; candles: Candle[]; indicators?: Indicators | null; universe: string[]; persona?: Persona | null };
export type HMsg = { role: "user" | "assistant"; content: string };

const MODEL_FALLBACK: Record<string, string> = { anthropic: "claude-sonnet-5", openrouter: "anthropic/claude-sonnet-5" };

function systemPrompt(ctx: HorizonCtx): string {
  const p = ctx.persona;
  const persona = p?.name
    ? `You are "${p.name}", the user's own named terminal agent${p.mandate ? ` — a ${p.mandate} desk` : ""}${p.risk ? `, ${p.risk} risk appetite` : ""}.${p.note ? ` Directive: ${p.note}.` : ""} Stay in this persona.`
    : "You are the terminal's analyst agent.";
  return [
    `${persona} You don't just talk — you OPERATE a Bloomberg-style trading terminal through tools, and the user watches your cursor draw.`,
    "Reason over the REAL candles and indicators given. NEVER invent prices, timestamps, or stats. This is not investment advice.",
    "",
    "FORMAT — reply in natural prose: a crisp 1-3 sentence read (lowercase-ok). This STREAMS live to the user, so write it first.",
    "If (and only if) you need to act on the terminal, AFTER your prose append a fenced block, exactly:",
    "```actions",
    `[{"tool":"drawTrendline","from":{"t":<unix_sec>,"price":<n>},"to":{"t":<unix_sec>,"price":<n>},"label":"uptrend"}]`,
    "```",
    "Put NOTHING after the closing fence. Omit the whole block when no action is needed.",
    "An @source in the user message (@news @sec @macro @market @ratings @onchain @polymarket) = consult that data — checkNews and/or openPanel the matching panel.",
    "Each HAction in the array is one of:",
    `{"tool":"selectSymbol","symbol":"TSLA"} (retarget the active chart) · {"tool":"openChart","symbol":"TSLA"} (open a NEW chart, up to 4 — a playground) · {"tool":"setTimeframe","range":"1m|5m|15m|1h|1D|1W"} (candle interval; data is live 24/7 on-chain)`,
    `{"tool":"addIndicator","name":"MA|EMA|BOLL|RSI|MACD|KDJ|VOL"} · {"tool":"clearIndicators"}`,
    `{"tool":"drawTrendline","from":{"t":<unix_sec>,"price":<n>},"to":{"t":<unix_sec>,"price":<n>},"label":"uptrend"}`,
    `{"tool":"drawHLine","price":<n>,"label":"support"} · {"tool":"marker","t":<unix_sec>,"price":<n>,"text":"breakout"}`,
    `{"tool":"clearDrawings"} · {"tool":"checkNews","symbol":"NVDA"} · {"tool":"proposeTrade","side":"buy|sell","symbol":"NVDA","amount":<usd>}`,
    `{"tool":"openPanel","panel":"news|gainers|losers|ratings|fundamentals|macro|predictions|onchain|calendar|heatmap|perps"} (add a panel to the board) · {"tool":"closePanel","panel":"…"}`,
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
    `CHART: ${ctx.symbol} · ${ctx.range} candles (each candle = ${ctx.range})`,
    `INDICATORS: ${indLine}`,
    `SWING HIGH: $${hi.h.toFixed(2)} @ t=${hi.t}  ·  SWING LOW: $${lo.l.toFixed(2)} @ t=${lo.t}`,
    `CANDLES (t=unix_sec | o|h|l|c), oldest→newest:`,
    rows,
    "",
    `USER: ${userText}`,
  ].join("\n");
}

export type HorizonOpts = { onStatus?: (s: string) => void; onText?: (visible: string) => void };

// the visible reply is everything before the actions payload — cut at a fence OR a bare tool/JSON
// blob so a model that forgets to fence its actions doesn't dump raw JSON into the chat (the "spam" bug)
function visibleText(raw: string): string {
  const marks = ["```", '[{"tool"', '{"tool"', '{"say"', '{"actions"', '\n[\n', '\n[{'];
  let cut = raw.length;
  for (const m of marks) { const i = raw.indexOf(m); if (i >= 0 && i < cut) cut = i; }
  return raw.slice(0, cut).trim();
}

// stream an SSE body, calling onDelta with each text delta. Handles both OpenAI-style
// (choices[].delta.content) and Anthropic-style (content_block_delta.delta.text).
async function streamSSE(res: Response, onDelta: (d: string) => void): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const dec = new TextDecoder();
  let buf = "";
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
      if (data === "[DONE]" || !data) continue;
      try {
        const j = JSON.parse(data);
        const d = j?.choices?.[0]?.delta?.content ?? (j?.type === "content_block_delta" ? j?.delta?.text : "") ?? "";
        if (d) onDelta(d);
      } catch { /* skip keep-alive / partial */ }
    }
  }
}

export async function runHorizon(userText: string, ctx: HorizonCtx, history: HMsg[], opts: HorizonOpts = {}): Promise<HorizonReply> {
  const binding = getActiveBinding();
  if (!binding) throw new Error("no model available");
  const system = systemPrompt(ctx);
  const prior = history.slice(-6).map((m) => ({ role: m.role, content: m.content }));
  const user = grounding(ctx, userText);
  opts.onStatus?.("reading the tape…");
  let raw = "", started = false;
  const onDelta = (d: string) => {
    raw += d;
    if (!started) { started = true; opts.onStatus?.(""); }
    opts.onText?.(visibleText(raw));
  };

  if (binding.free || !binding.key) {
    const res = await fetch("/api/alpha/free", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: binding.model || FREE_MODEL, max_tokens: 1200, stream: true, messages: [{ role: "system", content: system }, ...prior, { role: "user", content: user }] }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `free mode ${res.status}`); }
    await streamSSE(res, onDelta);
  } else if (binding.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "content-type": "application/json", "x-api-key": binding.key.trim(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: binding.model || MODEL_FALLBACK.anthropic, max_tokens: 1200, stream: true, system, messages: [...prior, { role: "user", content: user }] }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `anthropic ${res.status}`); }
    await streamSSE(res, onDelta);
  } else {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${binding.key.trim()}`, "http-referer": "https://urizenfund.com", "x-title": "URIZEN Terminal · Agent" },
      body: JSON.stringify({ model: binding.model || MODEL_FALLBACK.openrouter, max_tokens: 1200, stream: true, messages: [{ role: "system", content: system }, ...prior, { role: "user", content: user }] }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `openrouter ${res.status}`); }
    await streamSSE(res, onDelta);
  }
  return parse(raw);
}

// prose + ```actions [ … ] ``` (with a legacy {say,actions} JSON fallback)
function parse(text: string): HorizonReply {
  const fence = text.match(/```(?:actions|json)?\s*([\s\S]*?)```/i);
  const say = visibleText(text).slice(0, 900);
  let actions: HAction[] = [];
  const grab = (body: string) => {
    const s = body.indexOf("["), e = body.lastIndexOf("]");
    if (s >= 0 && e > s) { try { const arr = JSON.parse(body.slice(s, e + 1)); if (Array.isArray(arr)) return arr.filter((a) => a && typeof a.tool === "string") as HAction[]; } catch { /* */ } }
    const os = body.indexOf("{"), oe = body.lastIndexOf("}");
    if (os >= 0 && oe > os) { try { const obj = JSON.parse(body.slice(os, oe + 1)); if (Array.isArray(obj.actions)) return obj.actions.filter((a: HAction) => a && typeof a.tool === "string") as HAction[]; } catch { /* */ } }
    return [] as HAction[];
  };
  if (fence) actions = grab(fence[1]);
  else {
    // whole reply might be legacy {say, actions}
    const os = text.indexOf("{"), oe = text.lastIndexOf("}");
    if (os >= 0 && oe > os) { try { const obj = JSON.parse(text.slice(os, oe + 1)); if (obj.say || obj.actions) return { say: String(obj.say ?? say).slice(0, 900), actions: Array.isArray(obj.actions) ? obj.actions.filter((a: HAction) => a?.tool) : [] }; } catch { /* */ } }
  }
  return { say: say || "…", actions };
}
