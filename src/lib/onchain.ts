// Live on-chain stat fetchers for $URI on Robinhood Chain (4663).
//
// No indexer, no API keys required. Field names + endpoint shapes below were
// verified against live chain-4663 responses. Use these from a server route /
// Server Component (cache with `next: { revalidate }`) and pass the results
// into the dashboard once URIZEN_TOKEN is set.
//
// Sources per metric:
//   price / mcap / fdv / liquidity / 24h volume / price change -> DexScreener
//   name / symbol / decimals / totalSupply / holders / transfers -> Blockscout
//   trustless spot price (fallback) -> Uniswap v4 StateView.getSlot0 (needs viem)

import {
  ROBINHOOD_CHAIN,
  URIZEN_TOKEN,
  URIZEN_POOL,
  FLYWHEEL_LP_POOL,
  NON_CIRCULATING,
} from "./chain";

const DS = "https://api.dexscreener.com";
const GT = "https://api.geckoterminal.com/api/v2";
const BS = ROBINHOOD_CHAIN.blockscoutApi; // .../api/v2

export type MarketStats = {
  priceUsd: number;
  fdv: number;
  marketCap: number;
  liquidityUsd: number;
  volume24h: number;
  change24h: number;
  pairAddress: string;
  dexId: string; // "uniswap"
  labels: string[]; // e.g. ["v3"] or ["v4"]
};

/** DexScreener: discover the token's pools and return the deepest one's stats. */
async function getMarketStatsDS(token: string): Promise<MarketStats | null> {
  const r = await fetch(`${DS}/token-pairs/v1/${ROBINHOOD_CHAIN.dexscreenerSlug}/${token}`, {
    next: { revalidate: 30 },
  });
  if (!r.ok) return null;
  const pairs = (await r.json()) as any[];
  if (!Array.isArray(pairs) || pairs.length === 0) return null;
  // pick the pool with the most USD liquidity
  const p = pairs.reduce((best, cur) =>
    (cur?.liquidity?.usd ?? 0) > (best?.liquidity?.usd ?? 0) ? cur : best,
  );
  return {
    priceUsd: Number(p.priceUsd) || 0,
    fdv: Number(p.fdv) || 0,
    marketCap: Number(p.marketCap ?? p.fdv) || 0,
    liquidityUsd: Number(p.liquidity?.usd) || 0,
    volume24h: Number(p.volume?.h24) || 0,
    change24h: Number(p.priceChange?.h24) || 0,
    pairAddress: p.pairAddress,
    dexId: p.dexId,
    labels: p.labels ?? [],
  };
}

/** GeckoTerminal: the URI/WETH pool's stats direct from the pool id. Independent of DexScreener, so
 *  it keeps liquidity + price alive when DS rate-limits our serverless IPs (`reserve_in_usd` = LP value). */
async function getMarketStatsGT(): Promise<MarketStats | null> {
  const r = await fetch(`${GT}/networks/${ROBINHOOD_CHAIN.geckoterminalSlug}/pools/${URIZEN_POOL}`, {
    next: { revalidate: 30 },
  });
  if (!r.ok) return null;
  const a = (await r.json() as any)?.data?.attributes;
  if (!a) return null;
  return {
    priceUsd: Number(a.base_token_price_usd) || 0,
    fdv: Number(a.fdv_usd) || 0,
    marketCap: Number(a.market_cap_usd) || Number(a.fdv_usd) || 0,
    liquidityUsd: Number(a.reserve_in_usd) || 0,
    volume24h: Number(a.volume_usd?.h24) || 0,
    change24h: Number(a.price_change_percentage?.h24) || 0,
    pairAddress: URIZEN_POOL,
    dexId: "uniswap",
    labels: ["v4"],
  };
}

/** Market stats with a fallback chain: DexScreener first, GeckoTerminal when DS is down or a field
 *  (liquidity/price) is missing. Guarantees the LP value shows as long as either source is up. */
export async function getMarketStats(token: string): Promise<MarketStats | null> {
  const ds = await getMarketStatsDS(token);
  if (ds && ds.liquidityUsd > 0 && ds.priceUsd > 0) return ds;
  const gt = await getMarketStatsGT();
  if (!ds) return gt;
  if (!gt) return ds;
  // both present but DS missing a field → backfill from GeckoTerminal
  return {
    ...ds,
    priceUsd: ds.priceUsd || gt.priceUsd,
    liquidityUsd: ds.liquidityUsd || gt.liquidityUsd,
    marketCap: ds.marketCap || gt.marketCap,
    fdv: ds.fdv || gt.fdv,
    volume24h: ds.volume24h || gt.volume24h,
    change24h: ds.change24h || gt.change24h,
  };
}

export type FlywheelLp = {
  reserveUsd: number;
  volume24h: number;
  change24h: number;
  name: string;
};

/** The CASHCAT/SPCX flywheel LP the fund seeded — its live pooled value (reserve_in_usd) from
 *  GeckoTerminal. This is the on-chain market the flywheel step 4 creates, distinct from the $URI pool. */
export async function getFlywheelLp(): Promise<FlywheelLp | null> {
  const r = await fetch(`${GT}/networks/${ROBINHOOD_CHAIN.geckoterminalSlug}/pools/${FLYWHEEL_LP_POOL}`, {
    next: { revalidate: 60 },
  });
  if (!r.ok) return null;
  const a = (await r.json() as any)?.data?.attributes;
  if (!a) return null;
  const reserveUsd = Number(a.reserve_in_usd) || 0;
  if (!(reserveUsd > 0)) return null;
  return {
    reserveUsd,
    volume24h: Number(a.volume_usd?.h24) || 0,
    change24h: Number(a.price_change_percentage?.h24) || 0,
    name: a.name || "CASHCAT / SPCX",
  };
}

export type TokenMeta = {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: number; // human units
  holders: number;
  transfersCount: number;
  exchangeRateUsd: number | null;
};

/** Blockscout: token metadata + supply + holder/transfer counts. */
export async function getTokenMeta(token: string): Promise<TokenMeta | null> {
  const [infoR, ctrR] = await Promise.all([
    fetch(`${BS}/tokens/${token}`, { next: { revalidate: 120 } }),
    fetch(`${BS}/tokens/${token}/counters`, { next: { revalidate: 60 } }),
  ]);
  if (!infoR.ok) return null;
  const info = (await infoR.json()) as any;
  const ctr = ctrR.ok ? ((await ctrR.json()) as any) : {};
  const decimals = Number(info.decimals) || 18;
  return {
    name: info.name,
    symbol: info.symbol,
    decimals,
    totalSupply: Number(info.total_supply) / 10 ** decimals,
    holders: Number(ctr.token_holders_count ?? info.holders_count) || 0,
    transfersCount: Number(ctr.transfers_count) || 0,
    exchangeRateUsd: info.exchange_rate ? Number(info.exchange_rate) : null,
  };
}

export type Holder = { address: string; balance: number; pct: number };

/** Blockscout: top holders (descending). Pass decimals from getTokenMeta. */
export async function getTopHolders(token: string, decimals = 18, totalSupply = 0): Promise<Holder[]> {
  const r = await fetch(`${BS}/tokens/${token}/holders`, { next: { revalidate: 60 } });
  if (!r.ok) return [];
  const { items } = (await r.json()) as { items: any[] };
  return (items ?? []).map((it) => {
    const balance = Number(it.value) / 10 ** decimals;
    return {
      address: it.address?.hash ?? it.address,
      balance,
      pct: totalSupply > 0 ? (balance / totalSupply) * 100 : 0,
    };
  });
}

export type Transfer = {
  from: string;
  to: string;
  amount: number;
  hash: string;
  timestamp: string;
  method: string | null;
};

/** Blockscout: recent transfers — the buyback/activity feed. Filter to/from
 *  the treasury or burn (0x…dEaD) address to isolate buybacks. */
export async function getTransfers(token: string, decimals = 18): Promise<Transfer[]> {
  const r = await fetch(`${BS}/tokens/${token}/transfers`, { next: { revalidate: 30 } });
  if (!r.ok) return [];
  const { items } = (await r.json()) as { items: any[] };
  return (items ?? []).map((it) => ({
    from: it.from?.hash ?? "",
    to: it.to?.hash ?? "",
    amount: Number(it.total?.value ?? it.total) / 10 ** decimals,
    hash: it.transaction_hash,
    timestamp: it.timestamp,
    method: it.method ?? null,
  }));
}

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

/** GeckoTerminal OHLCV → full candles for the price chart (oldest→newest). */
export async function getCandles(
  timeframe: "day" | "hour" | "minute" = "hour",
  limit = 120,
): Promise<Candle[]> {
  const r = await fetch(
    `${GT}/networks/${ROBINHOOD_CHAIN.geckoterminalSlug}/pools/${URIZEN_POOL}/ohlcv/${timeframe}?limit=${limit}`,
    { next: { revalidate: 120 } },
  );
  if (!r.ok) return [];
  const j = (await r.json()) as any;
  const list: number[][] = j?.data?.attributes?.ohlcv_list ?? [];
  return list
    .map((row) => ({ t: row[0], o: row[1], h: row[2], l: row[3], c: row[4], v: row[5] }))
    .filter((k) => Number.isFinite(k.c))
    .sort((a, b) => a.t - b.t);
}

/** GeckoTerminal OHLCV → a simple close-price series for a sparkline/chart. */
export async function getPriceHistory(
  timeframe: "day" | "hour" | "minute" = "hour",
  limit = 168,
): Promise<{ t: number; v: number }[]> {
  const r = await fetch(
    `${GT}/networks/${ROBINHOOD_CHAIN.geckoterminalSlug}/pools/${URIZEN_POOL}/ohlcv/${timeframe}?limit=${limit}`,
    { next: { revalidate: 120 } },
  );
  if (!r.ok) return [];
  const j = (await r.json()) as any;
  const list: number[][] = j?.data?.attributes?.ohlcv_list ?? [];
  // ohlcv_list = [[ts, open, high, low, close, volume], ...] newest-first
  return list
    .map((row) => ({ t: row[0], v: row[4] }))
    .filter((p) => Number.isFinite(p.v))
    .sort((a, b) => a.t - b.t);
}

export type FundData = {
  live: boolean;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number;
  change24h: number;
  marketCap: number;
  fdv: number;
  liquidityUsd: number;
  volume24h: number;
  totalSupply: number;
  circulating: number;
  holders: number;
  transfersCount: number;
  history: { t: number; v: number }[];
  topHolders: Holder[];
  transfers: Transfer[];
  pairLabels: string[];
};

/** One server-side call that assembles everything the UI needs from real
 *  on-chain sources. Cached via each fetch's `revalidate`. */
export async function loadFundData(): Promise<FundData | null> {
  const token = URIZEN_TOKEN;
  const [market, meta, history, holders, transfers] = await Promise.all([
    getMarketStats(token),
    getTokenMeta(token),
    getPriceHistory("hour", 168),
    getTopHolders(token, 18),
    getTransfers(token, 18),
  ]);
  if (!meta && !market) return null;

  const decimals = meta?.decimals ?? 18;
  const totalSupply = meta?.totalSupply ?? 0;
  // recompute holder pct against total, flag non-circulating (pool/treasury)
  const top = (holders ?? []).map((h) => ({
    ...h,
    pct: totalSupply > 0 ? (h.balance / totalSupply) * 100 : 0,
  }));
  const nonCirc = top
    .filter((h) => NON_CIRCULATING.has(h.address.toLowerCase()))
    .reduce((s, h) => s + h.balance, 0);
  const circulating = Math.max(0, totalSupply - nonCirc);

  const priceUsd = market?.priceUsd ?? (meta?.exchangeRateUsd || 0);

  return {
    live: true,
    address: token,
    symbol: meta?.symbol ?? "URI",
    name: meta?.name ?? "Urizen",
    decimals,
    priceUsd,
    change24h: market?.change24h ?? 0,
    marketCap: market?.marketCap || priceUsd * circulating,
    fdv: market?.fdv || priceUsd * totalSupply,
    liquidityUsd: market?.liquidityUsd ?? 0,
    volume24h: market?.volume24h ?? 0,
    totalSupply,
    circulating,
    holders: meta?.holders ?? 0,
    transfersCount: meta?.transfersCount ?? 0,
    history,
    topHolders: top,
    transfers: transfers ?? [],
    pairLabels: market?.labels ?? [],
  };
}

// ---------------------------------------------------------------------------
// Trustless on-chain spot price via Uniswap v4 StateView (optional fallback).
// Requires viem. Left as a documented stub so we stay dependency-light until
// we actually need a price independent of the aggregators.
//
//   import { createPublicClient, http, keccak256, encodeAbiParameters } from "viem";
//   import { RH_UNIV4, RH_TOKENS, ROBINHOOD_CHAIN } from "./chain";
//
//   1. Build PoolKey { currency0, currency1, fee, tickSpacing, hooks } where
//      currency0 = min(token, USDG) by address (native ETH = 0x0 sorts first).
//   2. poolId = keccak256(encodeAbiParameters(POOLKEY_ABI, [poolKey]))
//   3. StateView.getSlot0(poolId) -> (sqrtPriceX96, tick, protocolFee, lpFee)
//   4. priceRaw = sqrtPriceX96^2 / 2^192   (currency1 per currency0, raw units)
//      If token is currency0:  priceUsd = priceRaw * 10^(dec0 - dec1)   // 10^(18-6)=1e12
//      If token is currency1:  priceUsd = 1 / (priceRaw * 10^(dec1 - dec0))
//      (do the math in BigInt; branch on address sort order or price inverts)
//   StateView address (chain 4663): RH_UNIV4.stateView
// ---------------------------------------------------------------------------
