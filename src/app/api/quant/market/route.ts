import { json, options } from "@/lib/api";

// The macro tape the studio shows above the fund book — S&P, Nasdaq, VIX, the 10Y, and DXY.
// Pulled server-side from Yahoo's public chart endpoint (keyless) because the browser can't
// read it cross-origin. If any one series fails we just omit it rather than fail the whole row.
export const revalidate = 0;

type MarketItem = { symbol: string; label: string; price: number; changePct: number };

const UA = "Mozilla/5.0 (compatible; urizen-quant/1.0)";

const SERIES: { symbol: string; label: string }[] = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq" },
  { symbol: "^DJI", label: "Dow" },
  { symbol: "^RUT", label: "Russell 2000" },
  { symbol: "^VIX", label: "VIX" },
  { symbol: "^TNX", label: "US 10Y" },
  { symbol: "DX-Y.NYB", label: "Dollar (DXY)" },
];

export function OPTIONS() {
  return options();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

async function fetchOne(symbol: string, label: string): Promise<MarketItem | null> {
  try {
    const upstream = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?range=1d&interval=1d`;
    const res = await fetch(upstream, {
      headers: { "User-Agent": UA },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();

    const chart = isRecord(data) ? data.chart : undefined;
    const result = isRecord(chart) && Array.isArray(chart.result) ? chart.result[0] : undefined;
    const meta = isRecord(result) ? result.meta : undefined;
    if (!isRecord(meta)) return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    if (typeof price !== "number" || typeof prevClose !== "number" || prevClose === 0) return null;

    return { symbol, label, price, changePct: (price / prevClose - 1) * 100 };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const settled = await Promise.all(SERIES.map((s) => fetchOne(s.symbol, s.label)));
    const items = settled.filter((x): x is MarketItem => x !== null);
    return json({ items });
  } catch (e) {
    return json(
      { error: `failed to load market: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
