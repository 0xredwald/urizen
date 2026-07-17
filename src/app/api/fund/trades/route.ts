import { json, options } from "@/lib/api";
import { getFundTrades } from "@/lib/fund-wallet";

export const revalidate = 15;
export const OPTIONS = options;

/** GET /api/fund/trades — the fund's live execution feed (real on-chain fills). */
export async function GET() {
  const trades = await getFundTrades(undefined, 25);
  return json({ count: trades.length, trades, updatedAt: new Date().toISOString() });
}
