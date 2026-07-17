// Robinhood Chain (4663) — addresses + endpoints for live on-chain stats.
// Verified against live chain-4663 endpoints (2026-07). No indexer needed:
// DexScreener + GeckoTerminal + Blockscout all index this chain.
//
// When $URI is deployed, set NEXT_PUBLIC_URIZEN_TOKEN (or URIZEN_TOKEN below)
// to the ERC-20 address and the dashboard can swap simulated data for real.

export const ROBINHOOD_CHAIN = {
  id: 4663,
  name: "Robinhood Chain",
  blockTimeSeconds: 2,
  rpc: "https://rpc.mainnet.chain.robinhood.com",
  blockscout: "https://robinhoodchain.blockscout.com",
  blockscoutApi: "https://robinhoodchain.blockscout.com/api/v2",
  // aggregator network slugs (both verified live for chain 4663)
  dexscreenerSlug: "robinhood",
  geckoterminalSlug: "robinhood",
} as const;

// Core tokens
export const RH_TOKENS = {
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", // cash leg
  usdgDecimals: 6,
} as const;

// Uniswap V3 on RH — the DexScreener-indexed venue CTRL uses for fund tokens.
// A $URI V3 pool is discoverable/priced by DexScreener + GeckoTerminal directly.
export const RH_UNIV3 = {
  factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
  router: "0xcaf681a66d020601342297493863e78c959e5cb2", // SwapRouter02
  quoter: "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7", // QuoterV2
  positionManager: "0x73991a25c818bf1f1128deaab1492d45638de0d3",
} as const;

// Uniswap V4 on RH — per-chain addresses (do NOT reuse mainnet addresses).
// StateView is the read-only helper: getSlot0(poolId) -> sqrtPriceX96, tick.
export const RH_UNIV4 = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  positionManager: "0x58daec3116aae6d93017baaea7749052e8a04fa7",
  quoter: "0x8dc178efb8111bb0973dd9d722ebeff267c98f94",
  universalRouter: "0x8876789976decbfcbbbe364623c63652db8c0904",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
} as const;

// $URI is LIVE on Robinhood Chain. Symbol: URI · name: Urizen · 18 decimals.
export const URIZEN_TOKEN =
  (process.env.NEXT_PUBLIC_URIZEN_TOKEN as `0x${string}` | undefined) ??
  "0x970078468807853bc316432e745165eb34398ba3";

// Uniswap v4 URI/WETH pool id (GeckoTerminal/DexScreener pool address).
export const URIZEN_POOL =
  "0xdb1548e55cda2a995769f1defe79100ec938f2a29551e1642c09cc735eaac10d";

// The flywheel LP the fund seeded: the CASHCAT/SPCX Uniswap v4 pool (the fund holds the v4 position
// NFT for it). GeckoTerminal pool id — used to show the LP's live USD value on the fund page.
export const FLYWHEEL_LP_POOL =
  "0x32f1253af0601ac5f9270fa107260298d749875bc2cac9102b21fb6ff838558b";

// Addresses whose balance is NOT circulating (LP singleton + the token's own
// contract treasury). Used to derive circulating supply from total.
export const NON_CIRCULATING = new Set(
  [RH_UNIV4.poolManager, "0x970078468807853bc316432e745165eb34398ba3"].map((a) =>
    a.toLowerCase(),
  ),
);

export const explorerTokenUrl = (addr: string) =>
  `${ROBINHOOD_CHAIN.blockscout}/token/${addr}`;
export const explorerTxUrl = (hash: string) =>
  `${ROBINHOOD_CHAIN.blockscout}/tx/${hash}`;
