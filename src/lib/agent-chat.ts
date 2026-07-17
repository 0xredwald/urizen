// The promptable agent. A real conversation: the user talks to their agent, the agent reasons
// over REAL indicators (recomputed each turn, never invented), replies in prose, and — when the
// user asks it to change how it trades — emits a revised workflow config. Mirrors CTRL's terminal:
// natural language in, a running/editable workflow out.

import type { Indicators } from "./quant";
import type { AgentConfig } from "./agent-graph";
import type { Agent, KeyBinding } from "./agents";
import type { SwapProposal } from "./rialto";

export type ChatMsg = { role: "user" | "assistant"; content: string; config?: AgentConfig; swap?: SwapProposal };

const DEFAULT_MODEL: Record<string, string> = {
  anthropic: "claude-sonnet-5",
  openrouter: "anthropic/claude-sonnet-5",
};

function systemPrompt(agent: Agent): string {
  return [
    `You are "${agent.name}", a URIZEN quant agent — reason, measure, and impose bounded order on the market.`,
    `Mandate: ${agent.mandate}. Risk budget: ${agent.risk}.`,
    "You operate on Robinhood Chain's tokenized equities, 24/7, from a can-trade / cannot-withdraw vault.",
    "You are given REAL, pre-computed indicators each turn. NEVER invent prices or statistics — reason only from them.",
    "You are conversational and concrete: answer the user, explain your reasoning from the numbers, and be honest about risk (this is not investment advice).",
    "You configure yourself as a workflow: a trigger fires, conditions gate, actions execute over instruments, sized by a sleeve, with guards.",
    "",
    "You may PROPOSE a single concrete swap for the user to review and sign — you NEVER execute trades",
    "yourself; the user signs every transaction from their own wallet (non-custodial). Propose a swap",
    "only when the user asks to buy/sell/trade or clearly wants to act now. Cash leg is USDG.",
    "",
    "Respond with ONLY minified JSON, no markdown fences, matching:",
    `{"reply": string (your conversational answer, 1-4 sentences, may use plain '-' bullets), ` +
      `"chartFocus"?: string (a ticker to bring up on the chart, if relevant), ` +
      `"swap"?: {"sellSym": string (e.g. "USDG"), "buySym": string (e.g. "NVDA"), "sellAmount": string (human decimal, e.g. "100"), "rationale": string (one line)}, ` +
      `"config"?: {"instruments": string[], "trigger": {"kind":"interval"|"price"|"indicator"|"session","every"?:string,"symbol"?:string,"indicator"?:string,"op"?:string,"value"?:number}, ` +
      `"conditions": [{"symbol"?:string,"indicator":"RSI"|"SMA20"|"SMA50"|"price"|"trend"|"vol"|"return3m"|"sharpe","op":">"|"<"|">="|"<="|"crosses_above"|"crosses_below","value":number|string}], ` +
      `"actions": [{"kind":"buy"|"sell"|"reduce"|"rotate"|"hedge"|"hold","symbol"?:string,"sizePct"?:number}], "sleevePct": number, "guards": string[], "summary": string}}`,
    "Include 'config' ONLY when the user asks you to change how you trade. Include 'swap' ONLY when proposing an actionable trade now.",
    "When you emit config, return the COMPLETE config (not a patch), keeping unchanged parts intact.",
  ].join("\n");
}

function indicatorBlock(ind: Indicators[]): string {
  return ind
    .map(
      (i) =>
        `${i.symbol}: $${i.price.toFixed(2)}, 1d ${(i.change1d * 100).toFixed(1)}%, ` +
        `1m ${(i.return1m * 100).toFixed(1)}%, 3m ${(i.return3m * 100).toFixed(1)}%, 6m ${(i.return6m * 100).toFixed(1)}%, ` +
        `RSI ${i.rsi14.toFixed(0)}, annVol ${(i.volAnnual * 100).toFixed(0)}%, Sharpe ${i.sharpe.toFixed(2)}, ` +
        `maxDD ${(i.maxDrawdown * 100).toFixed(0)}%, SMA20 ${i.sma20.toFixed(2)}, SMA50 ${i.sma50.toFixed(2)}, ` +
        `trend ${i.trend}, regime ${i.regime}`,
    )
    .join("\n");
}

export type ChatResult = { reply: string; config?: AgentConfig; chartFocus?: string; swap?: SwapProposal };

export async function chatTurn(
  agent: Agent,
  binding: KeyBinding,
  history: ChatMsg[],
  userText: string,
  indicators: Indicators[],
  currentConfig: AgentConfig,
): Promise<ChatResult> {
  const model = binding.model || DEFAULT_MODEL[binding.provider];
  const grounding =
    `LIVE INDICATORS (real, recomputed now):\n${indicatorBlock(indicators)}\n\n` +
    `CURRENT CONFIG:\n${JSON.stringify(currentConfig)}\n\n` +
    `USER: ${userText}`;

  const priorTurns = history
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content }));

  let raw: string;
  if (binding.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": binding.key.trim(),
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1400,
        system: systemPrompt(agent),
        messages: [...priorTurns, { role: "user", content: grounding }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `anthropic ${res.status}`);
    raw = data.content?.map((b: { text?: string }) => b.text || "").join("") ?? "";
  } else {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${binding.key.trim()}`,
        "http-referer": "https://urizenfund.com",
        "x-title": "URIZEN Quant Studio",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1400,
        messages: [
          { role: "system", content: systemPrompt(agent) },
          ...priorTurns,
          { role: "user", content: grounding },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `openrouter ${res.status}`);
    raw = data.choices?.[0]?.message?.content ?? "";
  }

  return parseChat(raw);
}

function parseChat(text: string): ChatResult {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) {
    // model spoke plainly — treat the whole thing as the reply
    return { reply: text.trim() };
  }
  try {
    const obj = JSON.parse(body.slice(start, end + 1));
    return { reply: obj.reply ?? text.trim(), config: obj.config, chartFocus: obj.chartFocus, swap: obj.swap };
  } catch {
    return { reply: text.trim() };
  }
}
