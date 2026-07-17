// The agent's workflow config — CTRL-grade: a trigger fires, conditions gate, actions execute,
// over a set of instruments, sized by a sleeve. This is the machine the chat agent builds and
// revises, the graph the canvas renders, and the thing that compiles to runnable strategy code.

export type IndicatorKey = "RSI" | "SMA20" | "SMA50" | "price" | "trend" | "vol" | "return3m" | "sharpe";
export type Op = ">" | "<" | ">=" | "<=" | "crosses_above" | "crosses_below";
export type TriggerKind = "interval" | "price" | "indicator" | "session";
export type ActionKind = "buy" | "sell" | "reduce" | "rotate" | "hedge" | "hold";

export type Trigger = {
  kind: TriggerKind;
  every?: string;        // interval/session cadence, e.g. "6h", "1d", "market-open"
  symbol?: string;       // for price/indicator triggers
  indicator?: IndicatorKey;
  op?: Op;
  value?: number;
};

export type Condition = {
  symbol?: string;       // omitted = applies per-instrument
  indicator: IndicatorKey;
  op: Op;
  value: number | string;
};

export type Action = {
  kind: ActionKind;
  symbol?: string;       // omitted = the triggering/selected instrument
  sizePct?: number;      // % of the sleeve to move
  note?: string;
};

export type AgentConfig = {
  instruments: string[];
  trigger: Trigger;
  conditions: Condition[];
  actions: Action[];
  sleevePct: number;     // % of book this agent governs
  guards: string[];      // risk guardrails, e.g. "stop -8%", "max 25% per name"
  summary: string;
};

export function defaultConfig(instruments: string[], mandate: string): AgentConfig {
  const base = { instruments, summary: "" };
  switch (mandate) {
    case "DCA":
      // Accumulate on a fixed cadence regardless of price — no gate.
      return { ...base, trigger: { kind: "interval", every: "1d" }, conditions: [], actions: [{ kind: "buy", sizePct: 10 }], sleevePct: 25, guards: ["max 30% per instrument"] };
    case "Momentum":
      return { ...base, trigger: { kind: "interval", every: "6h" }, conditions: [{ indicator: "trend", op: ">=", value: "up" }, { indicator: "RSI", op: "<", value: 70 }], actions: [{ kind: "buy", sizePct: 20 }], sleevePct: 25, guards: ["reduce 25% if RSI > 78", "max 30% per instrument"] };
    case "Rotation":
      // Hold the strongest names; only add where trend + risk-adjusted return agree.
      return { ...base, trigger: { kind: "interval", every: "1d" }, conditions: [{ indicator: "trend", op: ">=", value: "up" }, { indicator: "sharpe", op: ">=", value: 0.5 }], actions: [{ kind: "rotate", sizePct: 20 }], sleevePct: 30, guards: ["hold top 3 by 3m return", "max 40% per instrument"] };
    case "Yield":
      // Prefer low-volatility income (e.g. SGOV) — add when vol is calm.
      return { ...base, trigger: { kind: "interval", every: "1d" }, conditions: [{ indicator: "vol", op: "<", value: 0.3 }], actions: [{ kind: "buy", sizePct: 15 }], sleevePct: 25, guards: ["prefer low-vol / SGOV", "max 50% per instrument"] };
    case "Hedge":
      // De-risk when the trend rolls over; re-enter when it turns back up.
      return { ...base, trigger: { kind: "interval", every: "6h" }, conditions: [{ indicator: "trend", op: "<=", value: "down" }], actions: [{ kind: "reduce", sizePct: 30 }], sleevePct: 15, guards: ["raise cash when trend down", "re-enter on trend up"] };
    default:
      // Mean-reversion: buy weakness.
      return { ...base, trigger: { kind: "interval", every: "6h" }, conditions: [{ indicator: "RSI", op: "<", value: 45 }], actions: [{ kind: "buy", sizePct: 20 }], sleevePct: 25, guards: ["max 30% per instrument"] };
  }
}

// ── a portable skill file for the configured agent (run it anywhere) ──
export function configToSkill(name: string, mandate: string, risk: string, cfg: AgentConfig): string {
  const opWord = (op: string) => op.replace("crosses_above", "crosses above").replace("crosses_below", "crosses below");
  const trig = cfg.trigger.kind === "interval" || cfg.trigger.kind === "session"
    ? `every ${cfg.trigger.every ?? "6h"}`
    : `when ${cfg.trigger.symbol ?? ""} ${cfg.trigger.indicator ?? ""} ${opWord(cfg.trigger.op ?? "")} ${cfg.trigger.value ?? ""}`.trim();
  const emoji = { DCA: "⊞", Momentum: "⇗", Rotation: "⟳", Yield: "⊚", Hedge: "⊗" }[mandate] ?? "◈";
  return `---
name: ${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}
description: ${(cfg.summary || `${mandate} agent over ${cfg.instruments.join(", ")}`).slice(0, 180)}
emoji: "${emoji}"
homepage: https://urizenfund.com/studio
---

# ${name} — a URIZEN quant agent

A ${mandate} mandate (${risk} risk) over Robinhood-Chain tokenized equities, forged in URIZEN
Alpha. **Non-custodial**: it *proposes* trades on chain 4663 — the human signs every transaction,
and the agent never holds keys or custody.

## The workflow
- **When:** ${trig}
- **Conditions (all):**
${cfg.conditions.length ? cfg.conditions.map((c) => `  - ${c.symbol ? c.symbol + " " : ""}${c.indicator} ${opWord(c.op)} ${c.value}`).join("\n") : "  - (always)"}
- **Then:**
${cfg.actions.map((a) => `  - ${a.kind}${a.symbol ? " " + a.symbol : ""}${a.sizePct != null ? ` · ${a.sizePct}% of sleeve` : ""}`).join("\n")}
- **Instruments:** ${cfg.instruments.join(", ")}
- **Sleeve:** ${cfg.sleevePct}% of book
- **Guards:** ${cfg.guards.join(" · ") || "—"}

## Live data (keyless, CORS-open)
- Indicators substrate: \`GET https://urizenfund.com/api/quant/ohlc?symbol=NVDA&range=6m\`
- URIZEN fund state: \`GET https://urizenfund.com/api/fund/book\` · \`/stats\` · \`/strategies\`

## Trading (propose, never execute)
This agent may **propose** swaps of tokenized equities on Robinhood Chain (id 4663); the human
**signs every transaction** from their own wallet (non-custodial — the agent never holds keys or trades for the user).

- Get a quote (best route + a ready-to-sign tx): \`GET https://urizenfund.com/api/rialto/quote?sell_token=USDG&buy_token=NVDA&sell_amount=100&taker=<address>&slippage_bps=100\`
- Cash leg is **USDG**. Returns \`{ tx:{to,data,value}, buy_amount, min_buy_amount, route }\`. The human sends \`tx\` from their wallet on chain 4663.
- To propose: present the human the pair, size and a one-line rationale, then let them execute.

## Run it
Recompute indicators from live OHLC each tick, then apply the workflow above. Proposals only — the human confirms.

\`\`\`ts
${configToCode(name, mandate, risk, cfg)}
\`\`\`

*Reason is the measure. Not investment advice — a bounded, auditable machine.*
`;
}

// ── compile the config to a runnable strategy module (deterministic, no model) ──
export function configToCode(name: string, mandate: string, risk: string, cfg: AgentConfig): string {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  // Regime/trend conditions are string-valued → equality; numeric ops compare directly; a "cross"
  // is approximated by a level check (we recompute stateless per tick) and flagged in a comment.
  const condLine = (c: Condition) => {
    const key = `i.${c.indicator.toLowerCase()}`;
    if (typeof c.value === "string") return `${key} === ${JSON.stringify(c.value)}`;
    if (c.op.startsWith("crosses")) return `${key} ${c.op === "crosses_above" ? ">=" : "<="} ${c.value} /* ${c.op} (level proxy) */`;
    return `${key} ${c.op} ${c.value}`;
  };
  const fnFor = (k: ActionKind) => (k === "buy" || k === "rotate" ? "buy" : k === "hold" ? null : "reduce");
  return `// ${name} — compiled by URIZEN Quant Studio
// mandate ${mandate} · risk ${risk} · sleeve ${cfg.sleevePct}%
// A bounded, rules-based module for Robinhood-Chain tokenized equities. Non-custodial:
// it PROPOSES trades — the human signs every tx; the agent never holds keys or custody.

import type { Strategy } from "./types";

export const config = ${JSON.stringify(cfg, null, 2)} as const;

export const strategy: Strategy = {
  id: ${JSON.stringify(id)},
  name: ${JSON.stringify(name)},
  kind: ${JSON.stringify(mandate)},
  status: "arming",
  summary: ${JSON.stringify(cfg.summary)},
  targets: ${JSON.stringify(cfg.instruments)},
  cadence: ${JSON.stringify(cfg.trigger.every ?? "6h")},
  allocationPct: ${cfg.sleevePct},
};

// Runs each ${cfg.trigger.kind} tick (${cfg.trigger.every ?? "on signal"}); indicators recomputed
// from live OHLC via GET /api/quant/ohlc. buy()/reduce() emit PROPOSALS — the human signs.
export async function evaluate(ctx: {
  indicators: (s: string) => Promise<{ rsi: number; sma20: number; sma50: number; price: number; trend: string; vol: number; return3m: number; sharpe: number }>;
  buy: (s: string, sleevePct: number) => Promise<void>;    // propose a buy
  reduce: (s: string, pct: number) => Promise<void>;       // propose a reduce
}) {
  for (const sym of config.instruments) {
    const i = await ctx.indicators(sym);
    const pass = ${cfg.conditions.length ? cfg.conditions.map((c) => `(${condLine(c)})`).join(" && ") : "true"};
    if (pass) {
${cfg.actions.map((a) => { const fn = fnFor(a.kind); return fn ? `      await ctx.${fn}(sym, ${a.sizePct ?? cfg.sleevePct}); // ${a.kind}` : `      /* hold ${a.symbol ?? "sym"} — no action */`; }).join("\n")}
    }
  }
  // guards (enforce in your executor): ${cfg.guards.join(" · ") || "—"}
}
`;
}
