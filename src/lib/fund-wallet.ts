// Live reads of the URIZEN fund wallet on Robinhood Chain (4663) — its positions
// (tokenized equities + crypto it holds) and its on-chain execution feed. Blockscout
// v2, no key. The wallet is the fund's onchain trading account.

import { ROBINHOOD_CHAIN, RH_UNIV3, RH_UNIV4 } from "./chain";
import { STOCKS } from "./stocks";

const BS = ROBINHOOD_CHAIN.blockscoutApi;

// Uniswap v3+v4 liquidity contracts. A transfer to/from one of these is an LP operation (add/remove),
// NOT a buy/sell — this is the fix for alerts that said "sold" when the fund really added liquidity.
const LP_SET = new Set(
  [RH_UNIV4.poolManager, RH_UNIV4.positionManager, RH_UNIV3.positionManager].map((a) => a.toLowerCase()),
);

// The fund controls two wallets on Robinhood Chain: the original trading account and the treasury
// that claims Bankr fees and runs the CASHCAT/SPCX strategy.
export const FUND_WALLET = (process.env.NEXT_PUBLIC_FUND_WALLET ??
  "0x6e752fB542b2717eadafb6E2E6E9f593FCd51542") as `0x${string}`;
export const FUND_WALLET_2 = (process.env.NEXT_PUBLIC_FUND_WALLET_2 ??
  "0x9d1cd8a1517e436c967fe84444acd01fc8458e5a") as `0x${string}`;
export const FUND_WALLETS = [FUND_WALLET, FUND_WALLET_2] as const;
const FUND_WALLET_SET = new Set(FUND_WALLETS.map((w) => w.toLowerCase()));

const STOCK_SET = new Set(STOCKS.map((s) => s.address.toLowerCase()));
const SYM_BY_ADDR = new Map(STOCKS.map((s) => [s.address.toLowerCase(), s]));

export type Position = {
  symbol: string;
  name: string;
  address: string;
  amount: number;
  valueUsd: number | null;
  kind: "equity" | "etf" | "crypto" | "cash";
};

/** The fund's book: every token it holds, valued in USD via Blockscout's fiat feed. */
export async function getPositions(wallet = FUND_WALLET): Promise<Position[]> {
  const r = await fetch(`${BS}/addresses/${wallet}/token-balances`, { next: { revalidate: 30 } });
  if (!r.ok) return [];
  const rows = (await r.json()) as any[];
  const out: Position[] = [];
  for (const it of rows ?? []) {
    const t = it.token ?? {};
    const addr = String(t.address_hash ?? t.address ?? "").toLowerCase();
    const dec = Number(t.decimals ?? 18) || 18;
    const amount = Number(it.value ?? 0) / 10 ** dec;
    if (!(amount > 0)) continue;
    const px = Number(t.exchange_rate ?? 0) || null;
    const stock = SYM_BY_ADDR.get(addr);
    out.push({
      symbol: t.symbol ?? stock?.symbol ?? "?",
      name: t.name ?? stock?.name ?? "Token",
      address: addr,
      amount,
      valueUsd: px ? amount * px : null,
      kind: STOCK_SET.has(addr)
        ? (stock?.kind ?? "equity")
        : /USDG|USDC|USDT|USDE/i.test(t.symbol ?? "")
          ? "cash"
          : "crypto",
    });
  }
  // biggest holdings first (valued ones on top)
  return out.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
}

export type FundTradeKind = "buy" | "sell" | "swap" | "lp-add" | "lp-remove" | "lp" | "move";
export type FundTrade = {
  hash: string;
  timestamp: string;
  kind: FundTradeKind;
  symbol: string;          // primary token (acquired for buy/swap; added/removed for LP; sent for sell)
  name: string;
  amount: number;
  valueUsd: number | null;
  symbol2?: string;        // the paired token (swap: what was sold; LP: the other leg)
  amount2?: number;
};

/** Human label + tone for a classified trade — shared by the tape and the alert card. */
export function tradeLabel(t: FundTrade): { verb: string; tone: "up" | "down" | "lp" } {
  switch (t.kind) {
    case "buy": return { verb: "Bought", tone: "up" };
    case "sell": return { verb: "Sold", tone: "down" };
    case "swap": return { verb: t.symbol2 ? `Swapped ${t.symbol2} →` : "Swapped into", tone: "up" };
    case "lp-add": return { verb: "Added liquidity", tone: "lp" };
    case "lp-remove": return { verb: "Pulled liquidity", tone: "lp" };
    default: return { verb: "LP rebalance", tone: "lp" };
  }
}

type Leg = { symbol: string; name: string; amount: number; dir: "in" | "out"; cp: string; valueUsd: number | null };

/** The fund's live execution feed, grouped BY TRANSACTION and classified correctly:
 *  buy / sell / swap / lp-add / lp-remove — so LP moves are never mislabeled as sells. */
export async function getFundTrades(wallet = FUND_WALLET, limit = 20): Promise<FundTrade[]> {
  const r = await fetch(`${BS}/addresses/${wallet}/token-transfers?type=ERC-20`, { next: { revalidate: 20 } });
  if (!r.ok) return [];
  const { items } = (await r.json()) as { items: any[] };
  const w = wallet.toLowerCase();

  const byTx = new Map<string, { ts: string; legs: Leg[] }>();
  for (const it of items ?? []) {
    const t = it.token ?? {};
    const dec = Number(t.decimals ?? 18) || 18;
    const amount = Number(it.total?.value ?? 0) / 10 ** dec;
    const from = (it.from?.hash ?? "").toLowerCase();
    const to = (it.to?.hash ?? "").toLowerCase();
    const dir: "in" | "out" | null = from === w ? "out" : to === w ? "in" : null;
    if (!dir || !(amount > 0)) continue;
    const px = Number(t.exchange_rate ?? 0) || null;
    const leg: Leg = { symbol: t.symbol ?? "?", name: t.name ?? "Token", amount, dir, cp: dir === "out" ? to : from, valueUsd: px ? amount * px : null };
    const g = byTx.get(it.transaction_hash) ?? { ts: it.timestamp as string, legs: [] as Leg[] };
    g.legs.push(leg);
    byTx.set(it.transaction_hash, g);
  }

  const biggest = (arr: Leg[]) => arr.slice().sort((a, b) => (b.valueUsd ?? b.amount) - (a.valueUsd ?? a.amount))[0];
  const out: FundTrade[] = [];
  for (const [hash, { ts, legs }] of byTx) {
    const outs = legs.filter((l) => l.dir === "out");
    const ins = legs.filter((l) => l.dir === "in");
    const touchesLp = legs.some((l) => LP_SET.has(l.cp));
    const allFund = legs.every((l) => FUND_WALLET_SET.has(l.cp));

    let kind: FundTradeKind, prim: Leg, sec: Leg | undefined;
    if (allFund) { kind = "move"; prim = biggest(legs); }
    else if (touchesLp) {
      const lpOut = outs.filter((l) => LP_SET.has(l.cp));
      const lpIn = ins.filter((l) => LP_SET.has(l.cp));
      if (lpOut.length && !lpIn.length) { kind = "lp-add"; prim = biggest(lpOut); sec = lpOut.find((l) => l !== prim); }
      else if (lpIn.length && !lpOut.length) { kind = "lp-remove"; prim = biggest(lpIn); sec = lpIn.find((l) => l !== prim); }
      else { kind = "lp"; prim = biggest([...lpOut, ...lpIn]); }
    }
    else if (outs.length && ins.length) { kind = "swap"; prim = biggest(ins); sec = biggest(outs); } // acquired = the inbound token
    else if (outs.length) { kind = "sell"; prim = biggest(outs); }
    else { kind = "buy"; prim = biggest(ins); }

    out.push({ hash, timestamp: ts, kind, symbol: prim.symbol, name: prim.name, amount: prim.amount, valueUsd: prim.valueUsd, symbol2: sec?.symbol, amount2: sec?.amount });
  }
  return out.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
}

/** Per-wallet books for both fund wallets (for the two-wallet display). */
export async function getFundWallets(): Promise<{ wallet: string; book: Book }[]> {
  return Promise.all(FUND_WALLETS.map(async (wallet) => ({ wallet, book: await getBook(wallet) })));
}

export type Book = {
  wallet: string;
  positions: Position[];
  navUsd: number | null;
  equityCount: number;
};

/** Assemble the fund's book: positions + a rough NAV (sum of valued holdings). */
export async function getBook(wallet = FUND_WALLET): Promise<Book> {
  const positions = await getPositions(wallet);
  const valued = positions.filter((p) => p.valueUsd != null);
  const navUsd = valued.length ? valued.reduce((s, p) => s + (p.valueUsd ?? 0), 0) : null;
  const equityCount = positions.filter((p) => p.kind === "equity" || p.kind === "etf").length;
  return { wallet, positions, navUsd, equityCount };
}
