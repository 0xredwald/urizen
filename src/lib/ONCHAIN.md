# Wiring the dashboard to real Robinhood Chain data

Everything is ready to swap the simulated numbers for live on-chain stats the
moment `$URIZEN` is deployed. **No indexer, no API keys needed** — DexScreener,
GeckoTerminal and Blockscout all index Robinhood Chain (id 4663), verified live.

## Steps at launch

1. Set the token address: `NEXT_PUBLIC_URIZEN_TOKEN=0x…` (see `chain.ts`).
   Until it's set, `URIZEN_TOKEN` is `null` and the dashboard shows the
   "simulated until live" preview data.
2. In a Server Component / route, call the fetchers in `onchain.ts`:
   - `getMarketStats(token)` → price, mcap, FDV, liquidity, 24h volume, 24h change (DexScreener)
   - `getTokenMeta(token)` → name, symbol, decimals, total supply, holders, transfers count (Blockscout)
   - `getTopHolders(token, decimals, totalSupply)` → leaderboard (Blockscout)
   - `getTransfers(token, decimals)` → buyback / activity feed (Blockscout); filter to/from the treasury or `0x…dEaD` burn address for buybacks
3. Feed those into `fund-data.ts` in place of the seeded series, then drop the
   preview banner + "simulated" disclaimers.

## Venue note (important)

CTRL launches fund-token pools on **Uniswap V3** on RH (V3 is the DexScreener-
indexed venue there). If `$URIZEN` is a V3 pool, DexScreener/GeckoTerminal price
it directly. If it's a **V4** pool, `onchain.ts` documents the trustless
`StateView.getSlot0(poolId)` path (chain-4663 addresses in `chain.ts`, needs
`viem`) — but DexScreener's `token-pairs` endpoint already returned V4 pairs on
4663 in testing, so the aggregator path likely works for both.

## Key addresses (chain 4663) — in `chain.ts`

- RPC `https://rpc.mainnet.chain.robinhood.com` · Blockscout `https://robinhoodchain.blockscout.com`
- USDG (cash leg, 6dp) `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`
- V4 StateView `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` · PoolManager `0x8366a39C…40951`
- V3 factory `0x1f7d7550…2EfA` · QuoterV2 `0x33e885ed…a9e7`

## Legal

Robinhood Chain has a US-person geofence; agent discretion needs legal review.
Keep the "not investment advice" disclaimers until counsel signs off.
