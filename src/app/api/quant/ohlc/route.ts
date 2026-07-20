import { json, options } from "@/lib/api";
import { bySymbol } from "@/lib/stocks";
import { getDeepestPool, getPoolCandles, type Candle } from "@/lib/onchain";

// OHLC for the chart. PRIMARY source is RIALTO's own price feed (rialto-trade-api /ohlcv) — the exact
// clean open/high/low/close Rialto's charts use, keyed by the token contract address on chain 4663.
// This replaced GeckoTerminal pool OHLCV, whose thin-pool candles were erratic/looping. GeckoTerminal +
// Yahoo remain as fallbacks. The timeframe is a CANDLE INTERVAL (1m / 5m / 15m / 1h / 4h / 1D / 1W).
export const revalidate = 0;
const RIALTO = "https://rialto-trade-api.rialto.xyz";

// our interval → Rialto interval + seconds/bar + GeckoTerminal (tf, agg[, week]) + Yahoo (interval, range)
const INTERVALS: Record<string, { rialto: string; sec: number; gt: [("minute" | "hour" | "day"), number, "week"?]; yahoo: [string, string] }> = {
  "1m": { rialto: "1m", sec: 60, gt: ["minute", 1], yahoo: ["1m", "5d"] },
  "5m": { rialto: "5m", sec: 300, gt: ["minute", 5], yahoo: ["5m", "1mo"] },
  "15m": { rialto: "15m", sec: 900, gt: ["minute", 15], yahoo: ["15m", "3mo"] },
  "1h": { rialto: "1h", sec: 3600, gt: ["hour", 1], yahoo: ["60m", "1y"] },
  "4h": { rialto: "4h", sec: 14400, gt: ["hour", 4], yahoo: ["60m", "2y"] },
  "1D": { rialto: "1d", sec: 86400, gt: ["day", 1], yahoo: ["1d", "max"] },
  "1W": { rialto: "1w", sec: 604800, gt: ["day", 1, "week"], yahoo: ["1wk", "max"] },
};

export function OPTIONS() { return options(); }

// Rialto clean OHLCV, oldest→newest. The endpoint is public (no key required); we attach the key when
// we have it. `before` pages older bars.
async function rialto(token: string, interval: string, sec: number, limit: number, before?: number): Promise<Candle[]> {
  const key = process.env.RIALTO_API_KEY;
  const to = before || Math.floor(Date.now() / 1000);
  const from = to - Math.ceil(limit * sec * 1.4);
  const q = new URLSearchParams({ token, interval, from: String(from), to: String(to), limit: String(limit) });
  const headers: Record<string, string> = { accept: "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;
  const r = await fetch(`${RIALTO}/ohlcv?${q.toString()}`, { headers, next: { revalidate: 15 } });
  if (!r.ok) return [];
  const d = (await r.json()) as { data?: { timestamp: number; open: string; high: string; low: string; close: string; volume_base?: string }[] };
  const rows = Array.isArray(d?.data) ? d.data : [];
  return rows
    .map((x) => ({ t: Number(x.timestamp), o: +x.open, h: +x.high, l: +x.low, c: +x.close, v: +(x.volume_base ?? 0) }))
    .filter((k) => Number.isFinite(k.c) && Number.isFinite(k.t) && k.c > 0)
    .sort((a, b) => a.t - b.t);
}

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
  const keyIv = url.searchParams.get("interval") || url.searchParams.get("range") || "15m";
  const spec = INTERVALS[keyIv] ?? INTERVALS["15m"];
  const before = Number(url.searchParams.get("before")) || undefined;

  const stock = bySymbol(symbol);
  if (!stock) return json({ error: `unknown instrument ${symbol}` }, { status: 400 });

  let candles: Candle[] = [];
  let source = "rialto";

  // PRIMARY: Rialto's clean price feed
  try {
    candles = await rialto(stock.address, spec.rialto, spec.sec, 500, before);
    if (candles.length === 0 && keyIv === "1W") {
      const daily = await rialto(stock.address, "1d", 86400, 1200, before);
      if (daily.length) candles = toWeekly(daily);
    }
  } catch { /* fall through */ }

  // FALLBACK 1: GeckoTerminal on-chain pool OHLCV
  if (candles.length === 0) {
    source = "geckoterminal";
    try {
      const pool = await getDeepestPool(stock.address);
      if (pool) {
        const [tf, agg, weekly] = spec.gt;
        candles = await getPoolCandles(pool, stock.address, tf, agg, { before, limit: 1000 });
        if (weekly === "week") candles = toWeekly(candles);
      }
    } catch { /* fall through */ }
  }

  // FALLBACK 2: Yahoo (market-hours) — initial load only, it has no `before` paging
  if (candles.length === 0 && !before) {
    try { candles = await yahoo(symbol, spec.yahoo[0], spec.yahoo[1]); source = "yahoo"; } catch { /* */ }
    if (spec.gt[2] === "week" && candles.length) candles = toWeekly(candles);
  }

  if (candles.length === 0) return json({ symbol, interval: keyIv, candles: [], source, price: null, prevClose: null });
  const last = candles[candles.length - 1];
  return json({ symbol, interval: keyIv, candles, source, price: last.c, prevClose: prevClose(candles) });
}
