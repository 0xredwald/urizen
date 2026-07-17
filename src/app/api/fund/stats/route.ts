import { json, options } from "@/lib/api";
import { getMarketStats, getTokenMeta } from "@/lib/onchain";
import { URIZEN_TOKEN, ROBINHOOD_CHAIN } from "@/lib/chain";

export const revalidate = 15;
export const OPTIONS = options;

/** GET /api/fund/stats — live $URI market state (price, mcap, liquidity, holders). */
export async function GET() {
  const [m, meta] = await Promise.all([getMarketStats(URIZEN_TOKEN), getTokenMeta(URIZEN_TOKEN)]);
  return json({
    token: URIZEN_TOKEN,
    symbol: meta?.symbol ?? "URI",
    name: meta?.name ?? "Urizen",
    chainId: ROBINHOOD_CHAIN.id,
    priceUsd: m?.priceUsd ?? null,
    marketCapUsd: m?.marketCap ?? null,
    fdvUsd: m?.fdv ?? null,
    liquidityUsd: m?.liquidityUsd ?? null,
    volume24hUsd: m?.volume24h ?? null,
    change24hPct: m?.change24h ?? null,
    holders: meta?.holders ?? null,
    totalSupply: meta?.totalSupply ?? null,
    updatedAt: new Date().toISOString(),
  });
}
