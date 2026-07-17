import { json, options } from "@/lib/api";

// Analyst consensus ratings via Finnhub (recommendation-trends — free tier). The key lives
// only in server env (FINNHUB_API_KEY), never shipped to the browser. Heavily cached: ratings
// move slowly and Finnhub's free tier is 60/min, so we serve repeats from the CDN.
export const revalidate = 0;

const UA = "Mozilla/5.0 (compatible; urizen-quant/1.0)";

export function OPTIONS() {
  return options();
}

type Trend = { period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number };

// Weighted consensus label from the latest trend (strongBuy=2 … strongSell=-2).
function consensus(t: Trend): { label: string; score: number; total: number } {
  const total = t.strongBuy + t.buy + t.hold + t.sell + t.strongSell;
  if (!total) return { label: "No coverage", score: 0, total: 0 };
  const score = (t.strongBuy * 2 + t.buy - t.sell - t.strongSell * 2) / total;
  const label = score > 1 ? "Strong Buy" : score > 0.25 ? "Buy" : score > -0.25 ? "Hold" : score > -1 ? "Sell" : "Strong Sell";
  return { label, score, total };
}

export async function GET(req: Request) {
  const symbol = (new URL(req.url).searchParams.get("symbol") || "").replace(/^\$/, "").toUpperCase();
  if (!symbol) return json({ error: "provide ?symbol=" }, { status: 400 });

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return json({ symbol, available: false, note: "ratings not configured (FINNHUB_API_KEY unset)" }, { status: 503 });

  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${key}`, {
      headers: { "User-Agent": UA }, next: { revalidate: 3600 },
    });
    if (!r.ok) throw new Error(`finnhub ${r.status}`);
    const raw = await r.json() as { period?: string; strongBuy?: number; buy?: number; hold?: number; sell?: number; strongSell?: number }[];
    if (!Array.isArray(raw) || raw.length === 0) {
      return json({ symbol, available: false, note: "no analyst coverage" }, { headers: { "cache-control": "public, max-age=1800, s-maxage=3600" } });
    }
    const trend: Trend[] = raw.slice(0, 4).map((x) => ({
      period: x.period ?? "", strongBuy: x.strongBuy ?? 0, buy: x.buy ?? 0, hold: x.hold ?? 0, sell: x.sell ?? 0, strongSell: x.strongSell ?? 0,
    }));
    const c = consensus(trend[0]);
    return json({ symbol, available: true, consensus: c.label, score: Number(c.score.toFixed(2)), analysts: c.total, trend, source: "Finnhub" },
      { headers: { "cache-control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (e) {
    return json({ error: `failed to load ratings ${symbol}: ${(e as Error).message}` }, { status: 502 });
  }
}
