import { json, options } from "@/lib/api";

// Lighter perpetuals order book — server-side proxy (avoids browser CORS). Lighter is a zk-rollup
// central-limit order-book perp DEX; its public market data is keyless. We aggregate the raw resting
// orders into price levels (a real depth ladder) + best bid/ask/mid/spread for a market-context panel.
// Markets are crypto/index perps (BTC/ETH/SOL…), not the RH equity tokens — this is a derivatives view.
export const revalidate = 0;

const LIGHTER = "https://mainnet.zklighter.elliot.ai/api/v1";

export function OPTIONS() { return options(); }

type Order = { price: string; remaining_base_amount: string };
type Level = { price: number; size: number; cum: number };

function levels(orders: Order[], desc: boolean, max = 14): Level[] {
  const byPrice = new Map<number, number>();
  for (const o of orders) {
    const p = Number(o.price), s = Number(o.remaining_base_amount);
    if (!Number.isFinite(p) || !Number.isFinite(s) || s <= 0) continue;
    byPrice.set(p, (byPrice.get(p) ?? 0) + s);
  }
  const sorted = [...byPrice.entries()].sort((a, b) => (desc ? b[0] - a[0] : a[0] - b[0])).slice(0, max);
  let cum = 0;
  return sorted.map(([price, size]) => { cum += size; return { price, size, cum }; });
}

type Detail = { market_id?: number; mark_price?: string; index_price?: string; last_trade_price?: number; daily_price_change?: number; open_interest?: number };

export async function GET(req: Request) {
  const marketId = Number(new URL(req.url).searchParams.get("market_id")) || 1;
  try {
    const [obR, detR] = await Promise.all([
      fetch(`${LIGHTER}/orderBookOrders?market_id=${marketId}&limit=250`, { next: { revalidate: 2 }, headers: { Accept: "application/json" } }),
      fetch(`${LIGHTER}/orderBookDetails?market_id=${marketId}`, { next: { revalidate: 5 }, headers: { Accept: "application/json" } }),
    ]);
    if (!obR.ok) return json({ error: `lighter ${obR.status}`, bids: [], asks: [] }, { status: 200 });
    const d = (await obR.json()) as { asks?: Order[]; bids?: Order[] };
    const asks = levels(d.asks ?? [], false); // ascending price
    const bids = levels(d.bids ?? [], true);  // descending price
    const bestAsk = asks[0]?.price ?? null;
    const bestBid = bids[0]?.price ?? null;
    const mid = bestAsk != null && bestBid != null ? (bestAsk + bestBid) / 2 : (bestAsk ?? bestBid);
    const spread = bestAsk != null && bestBid != null ? bestAsk - bestBid : null;
    const spreadBps = spread != null && mid ? (spread / mid) * 10000 : null;

    // funding / basis from market details (mark vs index = the perp premium that drives funding)
    let mark: number | null = null, index: number | null = null, last: number | null = null;
    let basisBps: number | null = null, change24h: number | null = null, oi: number | null = null;
    if (detR.ok) {
      const det = ((await detR.json()) as { order_book_details?: Detail[] })?.order_book_details ?? [];
      const m = det.find((x) => x.market_id === marketId);
      if (m) {
        mark = Number(m.mark_price) || null;
        index = Number(m.index_price) || null;
        last = Number(m.last_trade_price) || null;
        change24h = typeof m.daily_price_change === "number" ? m.daily_price_change : null;
        oi = typeof m.open_interest === "number" ? m.open_interest : null;
        if (mark != null && index) basisBps = ((mark - index) / index) * 10000;
      }
    }
    return json({ marketId, bids, asks, bestBid, bestAsk, mid, spread, spreadBps, mark, index, last, basisBps, change24h, oi });
  } catch (e) {
    return json({ error: (e as Error).message, bids: [], asks: [] }, { status: 200 });
  }
}
