import { json, options } from "@/lib/api";
import { STOCKS } from "@/lib/stocks";

// Top gainers/losers across the tokenized-stock universe, from Yahoo's keyless chart endpoint (the
// batch quote API is now gated, so we fetch each symbol's 1d chart in parallel). Real % only.
export const revalidate = 0;
const UA = "Mozilla/5.0 (compatible; urizen-quant/1.0)";

export function OPTIONS() { return options(); }

type Mover = { symbol: string; name: string; price: number; changePct: number };

async function one(symbol: string, name: string): Promise<Mover | null> {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`, { headers: { "User-Agent": UA }, next: { revalidate: 120 } });
    if (!r.ok) return null;
    const m = (await r.json())?.chart?.result?.[0]?.meta;
    const price = m?.regularMarketPrice, prev = m?.chartPreviousClose;
    if (typeof price !== "number" || typeof prev !== "number" || !prev) return null;
    return { symbol, name, price, changePct: (price / prev - 1) * 100 };
  } catch { return null; }
}

export async function GET() {
  const settled = (await Promise.all(STOCKS.map((s) => one(s.symbol, s.name)))).filter((x): x is Mover => x !== null);
  const sorted = settled.slice().sort((a, b) => b.changePct - a.changePct);
  const n = Number(3);
  return json({ gainers: sorted.slice(0, n), losers: sorted.slice(-n).reverse(), universe: settled.length });
}
