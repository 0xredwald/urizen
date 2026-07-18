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

export async function GET(req: Request) {
  const marketId = Number(new URL(req.url).searchParams.get("market_id")) || 1;
  try {
    const r = await fetch(`${LIGHTER}/orderBookOrders?market_id=${marketId}&limit=250`, {
      next: { revalidate: 2 }, headers: { Accept: "application/json" },
    });
    if (!r.ok) return json({ error: `lighter ${r.status}`, bids: [], asks: [] }, { status: 200 });
    const d = (await r.json()) as { asks?: Order[]; bids?: Order[] };
    const asks = levels(d.asks ?? [], false); // ascending price
    const bids = levels(d.bids ?? [], true);  // descending price
    const bestAsk = asks[0]?.price ?? null;
    const bestBid = bids[0]?.price ?? null;
    const mid = bestAsk != null && bestBid != null ? (bestAsk + bestBid) / 2 : (bestAsk ?? bestBid);
    const spread = bestAsk != null && bestBid != null ? bestAsk - bestBid : null;
    const spreadBps = spread != null && mid ? (spread / mid) * 10000 : null;
    return json({ marketId, bids, asks, bestBid, bestAsk, mid, spread, spreadBps });
  } catch (e) {
    return json({ error: (e as Error).message, bids: [], asks: [] }, { status: 200 });
  }
}
