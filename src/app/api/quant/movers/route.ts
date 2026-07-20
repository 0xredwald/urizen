import { json, options } from "@/lib/api";
import { STOCKS } from "@/lib/stocks";
import { getTokenQuote } from "@/lib/onchain";

// The tokenized-stock universe, priced 24/7. PRIMARY source is RIALTO's price feed — Chainlink-sourced
// stock prices (accurate, and CONSISTENT with the Rialto chart the terminal draws). Falls back to
// on-chain DexScreener, then Yahoo. Returns the full universe + top/bottom movers; session is "24/7".
export const revalidate = 0;
const RIALTO = "https://rialto-trade-api.rialto.xyz";
const UA = "Mozilla/5.0 (compatible; urizen-quant/1.0)";

export function OPTIONS() { return options(); }

type Mover = { symbol: string; name: string; price: number; changePct: number };

// Rialto /prices?scope=all → map of token address → { price, 24h change % }. Public (key optional).
async function rialtoPrices(): Promise<Map<string, { price: number; changePct: number }>> {
  const map = new Map<string, { price: number; changePct: number }>();
  try {
    const key = process.env.RIALTO_API_KEY;
    const headers: Record<string, string> = { accept: "application/json" };
    if (key) headers.authorization = `Bearer ${key}`;
    const r = await fetch(`${RIALTO}/prices?scope=all`, { headers, next: { revalidate: 15 } });
    if (!r.ok) return map;
    const d = (await r.json()) as { prices?: { address: string; price: string; change_24h_pct?: string }[] };
    for (const p of d?.prices ?? []) {
      const price = parseFloat(p.price);
      if (Number.isFinite(price) && price > 0) map.set(p.address.toLowerCase(), { price, changePct: parseFloat(p.change_24h_pct || "0") || 0 });
    }
  } catch { /* fall through to per-symbol fallbacks */ }
  return map;
}

async function yahoo(symbol: string, name: string): Promise<Mover | null> {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`, { headers: { "User-Agent": UA }, next: { revalidate: 120 } });
    if (!r.ok) return null;
    const m = (await r.json())?.chart?.result?.[0]?.meta;
    const price = m?.regularMarketPrice, prev = m?.chartPreviousClose;
    if (typeof price !== "number" || typeof prev !== "number" || !prev) return null;
    return { symbol, name, price, changePct: (price / prev - 1) * 100 };
  } catch { return null; }
}

async function quote(symbol: string, name: string, token: string, rp: Map<string, { price: number; changePct: number }>): Promise<Mover | null> {
  const rialto = rp.get(token.toLowerCase());
  if (rialto) return { symbol, name, price: rialto.price, changePct: rialto.changePct };
  const oc = await getTokenQuote(token);
  if (oc && oc.price > 0) return { symbol, name, price: oc.price, changePct: oc.change24h };
  return yahoo(symbol, name);
}

export async function GET() {
  const rp = await rialtoPrices();
  const all = (await Promise.all(STOCKS.map((s) => quote(s.symbol, s.name, s.address, rp)))).filter((x): x is Mover => x !== null);
  const sorted = all.slice().sort((a, b) => b.changePct - a.changePct);
  return json({
    all,
    gainers: sorted.slice(0, 3),
    losers: sorted.slice(-3).reverse(),
    universe: all.length,
    session: "24/7",
    source: rp.size ? "rialto" : "onchain",
  });
}
