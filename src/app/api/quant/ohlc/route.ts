import { json, options } from "@/lib/api";
import { bySymbol } from "@/lib/stocks";

// Real daily OHLC for the tokenized-equity underlyings, proxied server-side from Yahoo's
// public chart endpoint (keyless). We never expose the source to the browser; the studio
// only ever sees normalized candles. Cached briefly so the agent console feels live without
// hammering the upstream.
export const revalidate = 0;

type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

const RANGES: Record<string, { range: string; interval: string }> = {
  // intraday (smaller timeframes) — Yahoo caps 1m at 7d, so use 5m/15m
  "1D": { range: "1d", interval: "5m" },
  "5D": { range: "5d", interval: "15m" },
  // daily and up
  "1M": { range: "1mo", interval: "1d" },
  "3M": { range: "3mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "5Y": { range: "5y", interval: "1wk" },
  // legacy lowercase aliases (older agent output / clients)
  "1m": { range: "1mo", interval: "1d" },
  "3m": { range: "3mo", interval: "1d" },
  "6m": { range: "6mo", interval: "1d" },
  "1y": { range: "1y", interval: "1d" },
  "2y": { range: "2y", interval: "1wk" },
};

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "NVDA").replace(/^\$/, "").toUpperCase();
  const rangeKey = url.searchParams.get("range") || "6m";
  const { range, interval } = RANGES[rangeKey] ?? RANGES["6m"];

  // Only allow the instruments the fund actually knows about (no open proxy).
  if (!bySymbol(symbol)) {
    return json({ error: `unknown instrument ${symbol}` }, { status: 400 });
  }

  const upstream = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=${range}&interval=${interval}`;

  try {
    const res = await fetch(upstream, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; urizen-quant/1.0)" },
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    const r = data?.chart?.result?.[0];
    if (!r) throw new Error("no result");

    const ts: number[] = r.timestamp ?? [];
    const q = r.indicators?.quote?.[0] ?? {};
    const candles: Candle[] = [];
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
      if (o == null || h == null || l == null || c == null) continue;
      candles.push({ t: ts[i], o, h, l, c, v: q.volume?.[i] ?? 0 });
    }
    if (candles.length < 2) throw new Error("insufficient candles");

    const meta = r.meta ?? {};
    return json({
      symbol,
      currency: meta.currency ?? "USD",
      price: meta.regularMarketPrice ?? candles[candles.length - 1].c,
      prevClose: meta.chartPreviousClose ?? candles[0].c,
      range: rangeKey,
      candles,
    });
  } catch (e) {
    return json(
      { error: `failed to load ${symbol}: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
