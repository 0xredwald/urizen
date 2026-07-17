import { json, options } from "@/lib/api";
import { getBook } from "@/lib/fund-wallet";
import { STRATEGIES } from "@/lib/strategies";

export const revalidate = 60;
export const OPTIONS = options;

// Copy-trade the fund: the live target weights of Urizen's real on-chain book,
// so an agent can replicate the allocation (e.g. mirror it via Bankr).
export async function GET() {
  const book = await getBook();
  const nav = book.navUsd ?? 0;
  const targets = book.positions
    .filter((p) => (p.valueUsd ?? 0) > 0)
    .map((p) => ({
      symbol: p.symbol,
      address: p.address,
      kind: p.kind,
      weightPct: nav ? Math.round(((p.valueUsd ?? 0) / nav) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.weightPct - a.weightPct);

  return json({
    updatedAt: new Date().toISOString(),
    wallet: book.wallet,
    navUsd: nav,
    strategies: STRATEGIES.map((s) => ({ id: s.id, name: s.name, kind: s.kind, status: s.status, targets: s.targets, cadence: s.cadence })),
    targets,
    note: "Replicate these weights to mirror the fund's book on Robinhood Chain, or take one-token exposure via $URI. Not investment advice.",
  });
}
