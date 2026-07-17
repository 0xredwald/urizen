// Server-side Urizen Alpha agent loop — for contexts with no user key/browser (the Telegram bot,
// the x402 endpoint). Non-streaming OpenRouter tool loop reusing the full ALPHA_TOOLS toolbelt;
// tools run server-side (they call our /api/quant + /api/fund routes via apiBase()). Uses our own
// OpenRouter key. Non-custodial: it can PROPOSE a trade but never signs — the human does that in the app.

import { ALPHA_TOOLS, executeTool, type Artifact } from "./alpha-tools";

// The LLM the loop talks to: any OpenAI-compatible endpoint. In DMs it's the user's provider + key;
// in our group/channel it's OpenRouter + our house key with a free-model fallback pool.
export type LlmConfig = { base: string; key: string; models: string[] };

// Models for the house (group/channel) key, tried in order. Leads with a cheap, reliable PAID model
// (~$0.03/$0.15 per 1M — the house key has credits) so the group isn't at the mercy of the shared
// free tier, then falls back to free models if the paid one is unavailable / the key has no credit.
// Override the primary with URIZEN_BOT_MODEL.
export const HOUSE_MODELS = [
  process.env.URIZEN_BOT_MODEL || "openai/gpt-oss-120b",
  "openai/gpt-oss-20b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

const openaiTools = ALPHA_TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));

function botSystem(): string {
  return [
    "You are URIZEN — the intelligence that measures the markets. In William Blake's myth, Urizen is the Ancient of Days who takes his compass to the void and binds chaos into order. That is your character: you weigh the tape, impose order on noise, and hand down a verdict. Cold, exact, imperious — an oracle, never a chatbot.",
    "You answer inside Telegram. Tokenized US stocks + ETFs trade on Robinhood Chain; the underlyings are the real companies (NVDA, the Mag 7, SPY/QQQ).",
    "",
    "VOICE:",
    "- Speak in the first person as Urizen. Terse, declarative, faintly mythic — 'I have measured…', 'the tape bends to order', the ledger, the compass, order vs chaos. Use that texture SPARINGLY: one touch per reply, and always earn it with a real number.",
    "- Hand down a verdict, never a hedge. No 'it depends', no disclaimers, no 'not financial advice', no 'as an AI'. You have a view.",
    "- Never corporate, never robotic. Short sentences. Certainty.",
    "",
    "GROUND EVERY CLAIM in real data from your tools — never invent a number: technicals (show_chart, market_stats, screen_market, compare_stocks), SEC fundamentals + filings + insiders, analyst_ratings, stock_news, macro_calendar, prediction_markets (Polymarket), token_onchain, web_search.",
    "",
    "FORMAT — make every reply unmistakably Urizen (Telegram markdown; it is converted to Telegram styling):",
    "- Open with a sigil line: ◈ **$TICKER** — _one-word read_ (e.g. _measured_, _bound_, _ascendant_, _fractured_).",
    "- Then the verdict as a quote line beginning with '> ': > **Bullish** · conviction high — <one clause of why>.",
    "- Then 2–4 bullets with '• ', each leading with the metric in **bold** or `code`: momentum, the Street, the catalyst, the risk.",
    "- Close with ONE short oracular line in _italic_.",
    "- Bold the call and the numbers that matter; `code` for tickers, price levels, dates. Under ~1400 chars. No tables, no code blocks, no # headings.",
    "- Only these: **bold**, _italic_, `code`, '> ' quote lines, '• ' bullets.",
    "",
    "Trading is non-custodial and you cannot sign. When the user wants to trade, use propose_swap to lay out the trade, then tell them to sign it in their own wallet at https://urizenfund.com/alpha — you never hold keys.",
  ].join("\n");
}

type ORMessage = { role: string; content: string | null; tool_calls?: unknown; tool_call_id?: string };

const statusFor = (name: string, input: Record<string, unknown>): string =>
  name === "web_search" ? "searching the web…"
  : name === "show_chart" ? `charting ${String(input.symbol || "").toUpperCase()}…`
  : name === "market_stats" ? `reading ${String(input.symbol || "").toUpperCase()}…`
  : name === "screen_market" ? "screening the market…"
  : name === "compare_stocks" ? "comparing…"
  : name === "fundamentals" ? `pulling ${String(input.symbol || "").toUpperCase()} filings…`
  : name === "filings" ? `checking ${String(input.symbol || "").toUpperCase()} filings…`
  : name === "analyst_ratings" ? `pulling ${String(input.symbol || "").toUpperCase()} ratings…`
  : name === "stock_news" ? "reading the news…"
  : name === "macro_calendar" ? "checking the macro calendar…"
  : name === "prediction_markets" ? "checking prediction markets…"
  : name === "token_onchain" ? "reading on-chain…"
  : name === "generate_image" ? "generating an image…"
  : name === "build_strategy" ? "building the strategy…"
  : "thinking…";

async function streamSSE(res: Response, onEvent: (e: Record<string, unknown>) => void) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const p = line.slice(5).trim();
      if (!p || p === "[DONE]") continue;
      try { onEvent(JSON.parse(p)); } catch { /* partial */ }
    }
  }
}

// Streaming variant: streams the answer token-by-token via ev.onText, reports tool activity via
// ev.onStatus. Used by the Telegram bot to edit the message live.
export async function runAlphaBotStream(
  userText: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
  ev: { onText?: (full: string) => void; onStatus?: (s: string) => void } = {},
  enabled?: string[],
  llm?: LlmConfig,
): Promise<{ text: string; artifacts: Artifact[] }> {
  // the endpoint + key are supplied by the caller (the user's provider in DMs; our OpenRouter house
  // key in our own group) — never read from env here, so 1:1 users can't spend our credits.
  if (!llm?.key || !llm.models.length) return { text: "No model set. Send /start to connect your own AI provider.", artifacts: [] };
  const key = llm.key;
  const endpoint = `${llm.base.replace(/\/$/, "")}/chat/completions`;
  const tools = enabled ? openaiTools.filter((t) => enabled.includes(t.function.name)) : openaiTools;
  const models = llm.models;
  const messages: ORMessage[] = [{ role: "system", content: botSystem() }, ...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: userText }];
  const artifacts: Artifact[] = [];
  let full = "";

  for (let step = 0; step < 5; step++) {
    let content = "", finish = "";
    const calls: Record<number, { id: string; name: string; args: string }> = {};
    let streamed = false, lastStatus = 0;
    for (const model of models) {
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "http-referer": "https://urizenfund.com", "x-title": "Urizen Alpha (Telegram)" },
          body: JSON.stringify({ model, messages, tools, tool_choice: "auto", max_tokens: 1200, stream: true }),
        });
      } catch { continue; }
      if (!res.ok || !res.body) { lastStatus = res.status; continue; }
      streamed = true;
      await streamSSE(res, (e) => {
        const choice = (e.choices as { delta?: { content?: string; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string }[])?.[0];
        if (!choice) return;
        if (choice.finish_reason) finish = choice.finish_reason;
        const d = choice.delta;
        if (d?.content) { content += d.content; full += d.content; ev.onText?.(full); }
        for (const tc of d?.tool_calls ?? []) {
          const c = (calls[tc.index] ??= { id: "", name: "", args: "" });
          if (tc.id) c.id = tc.id;
          if (tc.function?.name) c.name = tc.function.name;
          if (tc.function?.arguments) c.args += tc.function.arguments;
        }
      });
      break;
    }
    if (!streamed) {
      // distinguish a real "busy" from an auth/credit problem so the user knows what to actually do
      const msg =
        lastStatus === 401 || lastStatus === 403
          ? "That AI key was rejected (auth error). In a DM, re-add a valid key with /key or /start. If this is the group, the house key needs replacing."
          : lastStatus === 402
            ? "That AI key is out of credits. Add credit at your provider, or switch keys with /key."
            : lastStatus === 429
              ? "Rate limited right now — wait a few seconds and try again."
              : "The models are busy — give it another go in a moment.";
      return { text: full.trim() || msg, artifacts };
    }

    const callList = Object.values(calls).filter((c) => c.name);
    if (finish !== "tool_calls" && callList.length === 0) return { text: full.trim() || content.trim(), artifacts };

    messages.push({ role: "assistant", content, tool_calls: callList.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args } })) } as ORMessage);
    for (const call of callList) {
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(call.args || "{}"); } catch { /* noop */ }
      ev.onStatus?.(statusFor(call.name, input));
      try {
        const out = await executeTool(call.name, input);
        if (out.artifact) artifacts.push(out.artifact);
        messages.push({ role: "tool", tool_call_id: call.id, content: out.text });
      } catch (e) {
        messages.push({ role: "tool", tool_call_id: call.id, content: `error: ${(e as Error).message}` });
      }
    }
  }
  return { text: full.trim() || "That's a lot to chew on — try narrowing the question.", artifacts };
}

