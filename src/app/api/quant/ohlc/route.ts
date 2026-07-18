import { json, options } from "@/lib/api";
import { bySymbol } from "@/lib/stocks";
import { getDeepestPool, getPoolCandles, type Candle } from "@/lib/onchain";

// OHLC for the chart. The timeframe is a CANDLE INTERVAL (1m / 5m / 15m / 1h / 4h / 1D / 1W), not a
// date range. PRIMARY source is GeckoTerminal pool OHLCV — the tokens trade on-chain 24/7, so this is
// live around the clock with real minute candles and full on-chain history (page older with `before`).
// FALLBACK is Yahoo (market-hours, delayed) for symbols with no indexed pool or for long daily history.
export const revalidate = 0;

// interval → GeckoTerminal (timeframe, aggregate[, "week" to bucket]) + Yahoo (interval, range) fallback
const INTERVALS: Record<string, { gt: [("minute" | "hour" | "day"), number, "week"?]; yahoo: [string, string] }> = {
  "1m": { gt: ["minute", 1], yahoo: ["1m", "5d"] },
  "5m": { gt: ["minute", 5], yahoo: ["5m", "1mo"] },
  "15m": { gt: ["minute", 15], yahoo: ["15m", "3mo"] },
  "1h": { gt: ["hour", 1], yahoo: ["60m", "1y"] },
  "4h": { gt: ["hour", 4], yahoo: ["60m", "2y"] },
  "1D": { gt: ["day", 1], yahoo: ["1d", "max"] },
  "1W": { gt: ["day", 1, "week"], yahoo: ["1wk", "max"] },
};

export function OPTIONS() { return options(); }

// bucket daily candles into ISO weeks (Monday open)
function toWeekly(daily: Candle[]): Candle[] {
  const weeks = new Map<number, Candle>();
  for (const c of daily) {
    const d = new Date(c.t * 1000);
    const day = (d.getUTCDay() + 6) % 7; // Mon=0
    const monday = Math.floor((c.t - day * 86400) / 86400) * 86400;
    const w = weeks.get(monday);
    if (!w) weeks.set(monday, { t: monday, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v });
    else { w.h = Math.max(w.h, c.h); w.l = Math.min(w.l, c.l); w.c = c.c; w.v += c.v; }
  }
  return [...weeks.values()].sort((a, b) => a.t - b.t);
}

// prevClose ~24h before the last candle (for a real day-change), else the window's first close
function prevClose(candles: Candle[]): number {
  if (candles.length < 2) return candles[0]?.c ?? 0;
  const last = candles[candles.length - 1];
  const target = last.t - 86400;
  for (let i = candles.length - 2; i >= 0; i--) if (candles[i].t <= target) return candles[i].c;
  return candles[0].c;
}

async function yahoo(symbol: string, interval: string, range: string): Promise<Candle[]> {
  const upstream = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(upstream, { headers: { "User-Agent": "Mozilla/5.0 (compatible; urizen-quant/1.0)" }, next: { revalidate: 60 } });
  if (!res.ok) return [];
  const r = (await res.json())?.chart?.result?.[0];
  const ts: number[] = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0] ?? {};
  const out: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    out.push({ t: ts[i], o, h, l, c, v: q.volume?.[i] ?? 0 });
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "NVDA").replace(/^\$/, "").toUpperCase();
  const key = url.searchParams.get("interval") || url.searchParams.get("range") || "15m";
  const spec = INTERVALS[key] ?? INTERVALS["15m"];
  const before = Number(url.searchParams.get("before")) || undefined;

  const stock = bySymbol(symbol);
  if (!stock) return json({ error: `unknown instrument ${symbol}` }, { status: 400 });

  let candles: Candle[] = [];
  let source = "geckoterminal";
  try {
    const pool = await getDeepestPool(stock.address);
    if (pool) {
      const [tf, agg, weekly] = spec.gt;
      candles = await getPoolCandles(pool, stock.address, tf, agg, { before, limit: 1000 });
      if (weekly === "week") candles = toWeekly(candles);
    }
  } catch { /* fall through */ }

  // fallback to Yahoo when the token has no indexed pool / returned nothing (only for the initial load,
  // not history paging — Yahoo has no `before`)
  if (candles.length === 0 && !before) {
    try { candles = await yahoo(symbol, spec.yahoo[0], spec.yahoo[1]); source = "yahoo"; } catch { /* */ }
    if (spec.gt[2] === "week" && candles.length) candles = toWeekly(candles);
  }

  if (candles.length === 0) return json({ symbol, interval: key, candles: [], source, price: null, prevClose: null });
  const last = candles[candles.length - 1];
  return json({ symbol, interval: key, candles, source, price: last.c, prevClose: prevClose(candles) });
}
