import { json, options } from "@/lib/api";

// Annual fundamentals for a tokenized equity's real-world issuer, from SEC EDGAR's public XBRL
// company-facts API (keyless, but requires a descriptive User-Agent). We resolve ticker -> CIK
// once (cached module-level) and return the latest 10-K/FY figures. ETFs and private names (e.g.
// SPCX) have no SEC filer, so we return 200 with available:false rather than an error.
export const revalidate = 0;

// SEC fair-access policy requires a contact-style User-Agent; www.sec.gov 403s a generic one.
const UA = "Urizen Research admin@urizenfund.com";

type Latest = {
  fiscalYear: number | null;
  revenue: number | null;
  netIncome: number | null;
  netMargin: number | null;
  eps: number | null;
  assets: number | null;
  equity: number | null;
};

export function OPTIONS() {
  return options();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// Cache the ticker -> {cik,name} map so we hit company_tickers.json at most once per process.
let tickerMap: Map<string, { cik: number; name: string }> | null = null;

async function loadTickerMap(): Promise<Map<string, { cik: number; name: string }>> {
  if (tickerMap) return tickerMap;
  const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": UA },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`tickers ${res.status}`);
  const data: unknown = await res.json();
  const map = new Map<string, { cik: number; name: string }>();

  // Object form: { "0": { cik_str, ticker, title }, ... }
  // Array form:  { fields: [...], data: [[cik, ticker, name], ...] }
  if (isRecord(data) && Array.isArray((data as Record<string, unknown>).data)) {
    for (const row of (data as { data: unknown[] }).data) {
      if (Array.isArray(row) && row.length >= 3) {
        const cik = Number(row[0]);
        const ticker = String(row[1]).toUpperCase();
        if (Number.isFinite(cik)) map.set(ticker, { cik, name: String(row[2]) });
      }
    }
  } else if (isRecord(data)) {
    for (const v of Object.values(data)) {
      if (!isRecord(v)) continue;
      const ticker = typeof v.ticker === "string" ? v.ticker.toUpperCase() : null;
      const cik = typeof v.cik_str === "number" ? v.cik_str : Number(v.cik_str);
      const name = typeof v.title === "string" ? v.title : "";
      if (ticker && Number.isFinite(cik)) map.set(ticker, { cik, name });
    }
  }

  tickerMap = map;
  return map;
}

// From a us-gaap concept, take the value of the most recent annual (10-K / FY) filing.
function latestAnnual(
  gaap: Record<string, unknown>,
  concept: string,
  unit: string,
): { val: number; fy: number } | null {
  const node = gaap[concept];
  if (!isRecord(node)) return null;
  const units = node.units;
  if (!isRecord(units)) return null;
  const arr = units[unit];
  if (!Array.isArray(arr)) return null;

  let best: { val: number; fy: number; end: string } | null = null;
  for (const item of arr) {
    if (!isRecord(item)) continue;
    if (item.form !== "10-K" || item.fp !== "FY") continue;
    const val = item.val;
    const fy = item.fy;
    const end = typeof item.end === "string" ? item.end : "";
    if (typeof val !== "number" || typeof fy !== "number") continue;
    if (!best || end > best.end) best = { val, fy, end };
  }
  return best ? { val: best.val, fy: best.fy } : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "").replace(/^\$/, "").toUpperCase();
  if (!symbol) {
    return json({ error: "provide ?symbol=" }, { status: 400 });
  }

  try {
    const map = await loadTickerMap();
    const hit = map.get(symbol);
    if (!hit) {
      return json({
        symbol,
        available: false,
        note: "No SEC filer (private company or ETF)",
      });
    }

    const cik10 = String(hit.cik).padStart(10, "0");
    const res = await fetch(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10}.json`,
      { headers: { "User-Agent": UA }, next: { revalidate: 3600 } },
    );
    if (res.status === 404) {
      return json({
        symbol,
        available: false,
        note: "No SEC filer (private company or ETF)",
      });
    }
    if (!res.ok) throw new Error(`companyfacts ${res.status}`);
    const facts: unknown = await res.json();

    const gaap =
      isRecord(facts) && isRecord(facts.facts) && isRecord(facts.facts["us-gaap"])
        ? (facts.facts["us-gaap"] as Record<string, unknown>)
        : null;

    if (!gaap) {
      return json({
        symbol,
        available: false,
        note: "No SEC filer (private company or ETF)",
      });
    }

    const revenue =
      latestAnnual(gaap, "Revenues", "USD") ??
      latestAnnual(gaap, "RevenueFromContractWithCustomerExcludingAssessedTax", "USD");
    const netIncome = latestAnnual(gaap, "NetIncomeLoss", "USD");
    const assets = latestAnnual(gaap, "Assets", "USD");
    const equity = latestAnnual(gaap, "StockholdersEquity", "USD");
    const eps = latestAnnual(gaap, "EarningsPerShareDiluted", "USD/shares");

    const fiscalYear =
      revenue?.fy ?? netIncome?.fy ?? assets?.fy ?? equity?.fy ?? eps?.fy ?? null;
    const netMargin =
      netIncome && revenue && revenue.val !== 0 ? netIncome.val / revenue.val : null;

    const latest: Latest = {
      fiscalYear,
      revenue: revenue?.val ?? null,
      netIncome: netIncome?.val ?? null,
      netMargin,
      eps: eps?.val ?? null,
      assets: assets?.val ?? null,
      equity: equity?.val ?? null,
    };

    return json({ symbol, cik: hit.cik, name: hit.name, latest, source: "SEC EDGAR" }, { headers: { "cache-control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (e) {
    return json(
      { error: `failed to load fundamentals ${symbol}: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
