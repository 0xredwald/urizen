// Shared USD price lookup for a token symbol. USDG is the dollar; ETH/WETH price off
// CoinGecko; every tokenized stock prices off our own OHLC route (last close). Anything
// without a price source resolves to 0 (caller shows "—"). Used by the swap card and the
// wallet balances panel so they agree on valuation.
export async function fetchUsd(sym: string): Promise<number> {
  const s = sym.replace(/^\$/, "").toUpperCase();
  if (s === "USDG") return 1;
  try {
    if (s === "ETH" || s === "WETH") {
      const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
      return (await r.json())?.ethereum?.usd ?? 0;
    }
    const r = await fetch(`/api/quant/ohlc?symbol=${encodeURIComponent(s)}&range=1m`);
    return (await r.json())?.price ?? 0;
  } catch {
    return 0;
  }
}
