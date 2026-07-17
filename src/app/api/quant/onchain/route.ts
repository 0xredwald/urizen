import { json, options } from "@/lib/api";
import { bySymbol } from "@/lib/stocks";
import { URIZEN_TOKEN } from "@/lib/chain";

// Live on-chain price/liquidity for a Robinhood-Chain token, proxied from DexScreener (keyless,
// CORS-open — we still proxy so the studio has one origin and a stable shape). Resolves either a
// raw address or a known symbol (URI/URIZEN -> the fund token). Returns 200 with nulls + a note
// when the token has no indexed pool yet.
export const revalidate = 0;

const UA = "Mozilla/5.0 (compatible; urizen-quant/1.0)";

export function OPTIONS() {
  return options();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function num(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbolParam = url.searchParams.get("symbol");
  const addressParam = url.searchParams.get("address");

  let address: string | null = null;
  let symbol: string | null = null;

  if (addressParam && /^0x[0-9a-fA-F]{40}$/.test(addressParam)) {
    address = addressParam;
  } else if (symbolParam) {
    const s = symbolParam.replace(/^\$/, "").toUpperCase();
    symbol = s;
    if (s === "URI" || s === "URIZEN") {
      address = URIZEN_TOKEN;
      symbol = "URI";
    } else {
      const stock = bySymbol(s);
      if (stock) address = stock.address;
    }
  }

  if (!address) {
    return json({ error: "provide ?address=0x.. or a known ?symbol=" }, { status: 400 });
  }

  try {
    const upstream = `https://api.dexscreener.com/tokens/v1/robinhood/${address}`;
    const res = await fetch(upstream, {
      headers: { "User-Agent": UA },
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data: unknown = await res.json();

    const pairs = Array.isArray(data) ? data.filter(isRecord) : [];
    if (pairs.length === 0) {
      return json({
        address,
        symbol,
        priceUsd: null,
        liquidityUsd: null,
        volume24h: null,
        priceChange24h: null,
        pairUrl: null,
        note: "no indexed pool yet",
      });
    }

    // Highest-liquidity pair wins.
    const best = pairs.reduce((a, b) => {
      const la = isRecord(a.liquidity) ? num(a.liquidity.usd) ?? 0 : 0;
      const lb = isRecord(b.liquidity) ? num(b.liquidity.usd) ?? 0 : 0;
      return lb > la ? b : a;
    });

    const baseToken = isRecord(best.baseToken) ? best.baseToken : undefined;
    const liquidity = isRecord(best.liquidity) ? best.liquidity : undefined;
    const volume = isRecord(best.volume) ? best.volume : undefined;
    const priceChange = isRecord(best.priceChange) ? best.priceChange : undefined;

    return json({
      address,
      symbol:
        symbol ??
        (baseToken && typeof baseToken.symbol === "string" ? baseToken.symbol : null),
      priceUsd: num(best.priceUsd),
      liquidityUsd: liquidity ? num(liquidity.usd) : null,
      volume24h: volume ? num(volume.h24) : null,
      priceChange24h: priceChange ? num(priceChange.h24) : null,
      pairUrl: typeof best.url === "string" ? best.url : null,
    });
  } catch (e) {
    return json(
      { error: `failed to load onchain ${address}: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
