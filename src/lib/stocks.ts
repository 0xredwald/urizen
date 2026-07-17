// Robinhood-Chain tokenized equities — the on-chain stock market URIZEN allocates across.
// Real ERC-20 addresses on chain 4663 (docs.robinhood.com/chain/contracts), 18-dec, USDG-paired.
// These are the actual instruments a fund on Robinhood Chain trades 24/7.

export type Stock = { symbol: string; name: string; address: `0x${string}`; kind: "equity" | "etf" };

export const STOCKS: Stock[] = [
  { symbol: "NVDA", name: "NVIDIA", address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", kind: "equity" },
  { symbol: "AAPL", name: "Apple", address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", kind: "equity" },
  { symbol: "MSFT", name: "Microsoft", address: "0xe93237C50D904957Cf27E7B1133b510C669c2e74", kind: "equity" },
  { symbol: "GOOGL", name: "Alphabet", address: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3", kind: "equity" },
  { symbol: "AMZN", name: "Amazon", address: "0x12f190a9F9d7D37a250758b26824B97CE941bF54", kind: "equity" },
  { symbol: "META", name: "Meta Platforms", address: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35", kind: "equity" },
  { symbol: "TSLA", name: "Tesla", address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d", kind: "equity" },
  { symbol: "PLTR", name: "Palantir", address: "0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A", kind: "equity" },
  { symbol: "COIN", name: "Coinbase", address: "0x6330D8C3178a418788dF01a47479c0ce7CCF450b", kind: "equity" },
  { symbol: "AMD", name: "Advanced Micro Devices", address: "0x86923f96303D656E4aa86D9d42D1e57ad2023fdC", kind: "equity" },
  { symbol: "CRWV", name: "CoreWeave", address: "0x5f10A1C971B69e47e059e1dC91901B59b3fB49C3", kind: "equity" },
  { symbol: "MU", name: "Micron", address: "0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD", kind: "equity" },
  { symbol: "ORCL", name: "Oracle", address: "0xb0992820E760d836549ba69BC7598b4af75dEE03", kind: "equity" },
  { symbol: "CRCL", name: "Circle", address: "0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5", kind: "equity" },
  { symbol: "SPCX", name: "SpaceX", address: "0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa", kind: "equity" },
  { symbol: "SPY", name: "S&P 500", address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", kind: "etf" },
  { symbol: "QQQ", name: "Nasdaq 100", address: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68", kind: "etf" },
  { symbol: "SGOV", name: "US Treasuries", address: "0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5", kind: "etf" },
  { symbol: "SLV", name: "Silver", address: "0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f", kind: "etf" },
];

/** The Magnificent Seven — the megacap core the fund weights toward. */
export const MAG7 = ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA"];

export const bySymbol = (s: string) => STOCKS.find((x) => x.symbol === s);
