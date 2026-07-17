// A real backtest — no model, no hand-waving. Walks the actual historical candles day by day
// (strictly no lookahead: indicators at day t use only data[0..t]), applies the agent's config
// rules, and tracks a portfolio against an equal-weight buy-&-hold benchmark. Every number the
// backtest panel shows comes from here.

import type { OhlcResponse } from "./quant";
import { rsi, sma, logReturns } from "./quant";
import type { AgentConfig, Condition, IndicatorKey, Op } from "./agent-graph";

export type BacktestResult = {
  equity: { t: number; v: number }[];
  benchmark: { t: number; v: number }[];
  totalReturn: number;
  benchReturn: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  trades: number;
  finalValue: number;
  perName: { symbol: string; trades: number; ret: number }[];
};

const START = 100_000;

type Snap = { price: number; rsi: number; sma20: number; sma50: number; trend: string; vol: number; return3m: number; sharpe: number };

// indicators from the closes seen SO FAR (index t inclusive) — no future data
function snapshotAt(closes: number[], t: number): Snap {
  const win = closes.slice(0, t + 1);
  const price = win[win.length - 1];
  const s20 = sma(win, 20); const s50 = sma(win, 50);
  const sma20 = s20[s20.length - 1] || price;
  const sma50 = s50[s50.length - 1] || price;
  const rr = logReturns(win.slice(-63));
  const m = rr.reduce((a, b) => a + b, 0) / (rr.length || 1);
  const sd = Math.sqrt(rr.reduce((a, b) => a + (b - m) ** 2, 0) / (rr.length || 1));
  const trend = price > sma20 && sma20 > sma50 ? "up" : price < sma20 && sma20 < sma50 ? "down" : "flat";
  const r3 = win.length > 63 ? win[win.length - 1] / win[win.length - 64] - 1 : win[win.length - 1] / win[0] - 1;
  return {
    price, rsi: rsi(win, 14), sma20, sma50, trend,
    vol: sd * Math.sqrt(252), return3m: r3, sharpe: sd ? (m / sd) * Math.sqrt(252) : 0,
  };
}

function fieldOf(s: Snap, k: IndicatorKey): number | string {
  switch (k) {
    case "RSI": return s.rsi;
    case "SMA20": return s.sma20;
    case "SMA50": return s.sma50;
    case "price": return s.price;
    case "trend": return s.trend;
    case "vol": return s.vol;
    case "return3m": return s.return3m;
    case "sharpe": return s.sharpe;
  }
}

function cmp(a: number | string, op: Op, b: number | string): boolean {
  if (typeof a === "string" || typeof b === "string") {
    // for categorical fields (e.g. trend), >= / crosses_above read as "equals"
    return op === ">=" || op === "crosses_above" ? String(a) === String(b) : String(a) !== String(b);
  }
  switch (op) {
    case ">": case "crosses_above": return a > b;
    case "<": case "crosses_below": return a < b;
    case ">=": return a >= b;
    case "<=": return a <= b;
  }
}

function passes(conds: Condition[], s: Snap): boolean {
  if (!conds.length) return true;
  return conds.every((c) => {
    const lhs = fieldOf(s, c.indicator);
    // special-case SMA crosses: price vs SMA
    if (c.indicator === "SMA20" || c.indicator === "SMA50") {
      return cmp(s.price, c.op, fieldOf(s, c.indicator));
    }
    return cmp(lhs, c.op, c.value);
  });
}

export function backtest(config: AgentConfig, series: Record<string, OhlcResponse>): BacktestResult {
  const syms = config.instruments.filter((s) => series[s]?.candles?.length);
  if (!syms.length) throw new Error("no data to backtest");

  // align on the shortest series length; index by position from the end
  const closesBy: Record<string, number[]> = {};
  const tsBy: Record<string, number[]> = {};
  let n = Infinity;
  for (const s of syms) {
    closesBy[s] = series[s].candles.map((k) => k.c);
    tsBy[s] = series[s].candles.map((k) => k.t);
    n = Math.min(n, closesBy[s].length);
  }
  const warm = Math.min(55, Math.floor(n * 0.4));

  const hasSell = config.actions.some((a) => a.kind === "reduce" || a.kind === "sell" || a.kind === "hedge" || a.kind === "rotate");
  const buyAct = config.actions.find((a) => a.kind === "buy") ?? { kind: "buy" as const, sizePct: 20 };
  const maxPerName = 1 / Math.max(1, syms.length) + 0.15; // soft cap as a fraction of book

  let cash = START;
  const shares: Record<string, number> = Object.fromEntries(syms.map((s) => [s, 0]));
  const cost: Record<string, number> = Object.fromEntries(syms.map((s) => [s, 0]));
  const nameTrades: Record<string, number> = Object.fromEntries(syms.map((s) => [s, 0]));
  const equity: { t: number; v: number }[] = [];
  const bench: { t: number; v: number }[] = [];
  let wins = 0, closed = 0, trades = 0;

  // benchmark: equal-weight buy & hold from warm
  const benchShares: Record<string, number> = {};

  for (let t = warm; t < n; t++) {
    // portfolio mark
    let equ = cash;
    for (const s of syms) equ += shares[s] * closesBy[s][closesBy[s].length - n + t];
    const ts = tsBy[syms[0]][tsBy[syms[0]].length - n + t];

    // init benchmark on first bar
    if (t === warm) {
      for (const s of syms) {
        const px = closesBy[s][closesBy[s].length - n + t];
        benchShares[s] = (START / syms.length) / px;
      }
    }

    // evaluate rules per instrument (interval trigger ≈ each session on daily candles)
    const sleeveUsd = (config.sleevePct / 100) * equ;
    for (const s of syms) {
      const cl = closesBy[s];
      const localT = cl.length - n + t;
      const snap = snapshotAt(cl, localT);
      const px = snap.price;
      const held = shares[s] * px;
      const pass = passes(config.conditions, snap);

      if (pass && held < maxPerName * equ && cash > 10) {
        const spend = Math.min(cash, (sleeveUsd * (buyAct.sizePct ?? 20)) / 100);
        if (spend > 10) {
          const q = spend / px;
          shares[s] += q; cost[s] += spend; cash -= spend; trades++; nameTrades[s]++;
        }
      } else if (!pass && hasSell && shares[s] > 0) {
        // exit: rules broke — realize
        const proceeds = shares[s] * px;
        if (proceeds > cost[s]) wins++;
        closed++; cash += proceeds; trades++; nameTrades[s]++;
        shares[s] = 0; cost[s] = 0;
      }
    }

    equity.push({ t: ts, v: equ });
    let bv = 0;
    for (const s of syms) bv += benchShares[s] * closesBy[s][closesBy[s].length - n + t];
    bench.push({ t: ts, v: bv });
  }

  // close-out remaining for win accounting
  for (const s of syms) if (shares[s] > 0) { const px = closesBy[s][closesBy[s].length - 1]; if (shares[s] * px > cost[s]) wins++; closed++; }

  const eqVals = equity.map((e) => e.v);
  const rets = logReturns(eqVals);
  const m = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / (rets.length || 1));
  let peak = eqVals[0] || START, mdd = 0;
  for (const v of eqVals) { if (v > peak) peak = v; const dd = (peak - v) / peak; if (dd > mdd) mdd = dd; }
  const finalV = eqVals[eqVals.length - 1] || START;
  const benchFinal = bench[bench.length - 1]?.v || START;

  return {
    equity, benchmark: bench,
    totalReturn: finalV / START - 1,
    benchReturn: benchFinal / START - 1,
    sharpe: sd ? (m / sd) * Math.sqrt(252) : 0,
    maxDrawdown: mdd,
    winRate: closed ? wins / closed : 0,
    trades,
    finalValue: finalV,
    perName: syms.map((s) => ({ symbol: s, trades: nameTrades[s], ret: 0 })),
  };
}
