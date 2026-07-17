import { json, options } from "@/lib/api";
import { getBook } from "@/lib/fund-wallet";

export const revalidate = 20;
export const OPTIONS = options;

/** GET /api/fund/book — the fund's live positions (tokenized equities + crypto) + NAV. */
export async function GET() {
  const book = await getBook();
  return json({
    wallet: book.wallet,
    navUsd: book.navUsd,
    positionsCount: book.positions.length,
    equityCount: book.equityCount,
    positions: book.positions.map((p) => ({
      symbol: p.symbol,
      name: p.name,
      kind: p.kind,
      amount: p.amount,
      valueUsd: p.valueUsd,
      address: p.address,
    })),
    updatedAt: new Date().toISOString(),
  });
}
