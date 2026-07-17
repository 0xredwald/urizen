// Pure quant math — every number the studio shows is computed here from real OHLC,
// never invented by a model. The agent's LLM only ever *interprets* these; it does not
// produce them. Keep this dependency-free and deterministic.

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

export type OhlcResponse = {
  symbol: string;
  currency: string;
  price: number;
  prevClose: number;
  range: string;
  candles: Candle[];
};

import { apiBase } from "./api-base";

export async function fetchOhlc(symbol: string, range = "6m"): Promise<OhlcResponse> {
  const res = await fetch(`${apiBase()}/api/quant/ohlc?symbol=${encodeURIComponent(symbol)}&range=${range}`, {
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "failed to load prices");
  return data as OhlcResponse;
}

const closes = (cs: Candle[]) => cs.map((k) => k.c);

/** Simple moving average series (NaN before the window fills). */
export function sma(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average series. */
export function ema(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  const k = 2 / (period + 1);
  let prev = values[0];
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI (14 default). Returns the latest value. */
export function rsi(values: number[], period = 14): number {
  if (values.length <= period) return 50;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= period; loss /= period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (loss === 0) return 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

/** Daily log returns. */
export function logReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) out.push(Math.log(values[i] / values[i - 1]));
  return out;
}

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const std = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};

/** Annualized volatility from daily returns (252 trading days). */
export function annualizedVol(rets: number[]): number {
  return std(rets) * Math.sqrt(252);
}

/** Annualized Sharpe (rf≈0), from daily returns. */
export function sharpe(rets: number[]): number {
  const s = std(rets);
  if (s === 0) return 0;
  return (mean(rets) / s) * Math.sqrt(252);
}

/** Maximum drawdown over the window, as a positive fraction (0.32 = −32%). */
export function maxDrawdown(values: number[]): number {
  let peak = values[0], mdd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > mdd) mdd = dd;
  }
  return mdd;
}

/** Trailing return over the last n closes, as a fraction. */
export function trailingReturn(values: number[], n: number): number {
  if (values.length <= n) return values[values.length - 1] / values[0] - 1;
  return values[values.length - 1] / values[values.length - 1 - n] - 1;
}

export type Indicators = {
  symbol: string;
  price: number;
  change1d: number; // fraction
  return1m: number;
  return3m: number;
  return6m: number;
  rsi14: number;
  volAnnual: number; // fraction
  sharpe: number;
  maxDrawdown: number; // fraction
  sma20: number;
  sma50: number;
  aboveSma50: boolean;
  trend: "up" | "down" | "flat";
  regime: "risk-on" | "neutral" | "risk-off";
};

/** Everything the agent reasons over, derived from real candles. */
export function computeIndicators(data: OhlcResponse): Indicators {
  const cs = data.candles;
  const c = closes(cs);
  const rets = logReturns(c);
  const s20 = sma(c, 20);
  const s50 = sma(c, 50);
  const last = c[c.length - 1];
  const sma20 = s20[s20.length - 1] || last;
  const sma50 = s50[s50.length - 1] || last;
  const volA = annualizedVol(rets);
  const r6 = trailingReturn(c, 126);
  const rsiV = rsi(c, 14);

  const trend: Indicators["trend"] =
    last > sma20 && sma20 > sma50 ? "up" : last < sma20 && sma20 < sma50 ? "down" : "flat";
  const regime: Indicators["regime"] =
    trend === "up" && rsiV < 72 ? "risk-on" : trend === "down" || rsiV > 78 ? "risk-off" : "neutral";

  return {
    symbol: data.symbol,
    price: last,
    // true last-session change (last candle vs the one before). NOT chartPreviousClose,
    // which for a multi-month range is the close *before the whole range* → a wrong "1d".
    change1d: trailingReturn(c, 1),
    return1m: trailingReturn(c, 21),
    return3m: trailingReturn(c, 63),
    return6m: r6,
    rsi14: rsiV,
    volAnnual: volA,
    sharpe: sharpe(rets),
    maxDrawdown: maxDrawdown(c),
    sma20,
    sma50,
    aboveSma50: last >= sma50,
    trend,
    regime,
  };
}
