import { json, options } from "@/lib/api";

// Recent SEC filings for a tokenized equity's real-world issuer, from EDGAR's public submissions
// API (keyless, descriptive User-Agent required). We resolve ticker -> CIK once (cached
// module-level) and surface the latest material filings + an insider-activity (Form 4) count.
// ETFs and private names have no SEC filer, so we return 200 with available:false.
export const revalidate = 0;

// SEC fair-access policy requires a contact-style User-Agent; www.sec.gov 403s a generic one.
const UA = "Urizen Research admin@urizenfund.com";
const FORMS = new Set(["10-K", "10-Q", "8-K", "4"]);

type Filing = { form: string; date: string; url: string };

export function OPTIONS() {
  return options();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// Independent copy of the ticker -> {cik,name} resolver (kept self-contained per route).
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

function strAt(arr: unknown, i: number): string {
  return Array.isArray(arr) && typeof arr[i] === "string" ? (arr[i] as string) : "";
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
    const res = await fetch(`https://data.sec.gov/submissions/CIK${cik10}.json`, {
      headers: { "User-Agent": UA },
      next: { revalidate: 1800 },
    });
    if (res.status === 404) {
      return json({
        symbol,
        available: false,
        note: "No SEC filer (private company or ETF)",
      });
    }
    if (!res.ok) throw new Error(`submissions ${res.status}`);
    const data: unknown = await res.json();

    const filingsNode = isRecord(data) ? data.filings : undefined;
    const recent = isRecord(filingsNode) ? filingsNode.recent : undefined;
    if (!isRecord(recent)) throw new Error("no recent filings");

    const forms = recent.form;
    const dates = recent.filingDate;
    const accs = recent.accessionNumber;
    const docs = recent.primaryDocument;
    const n = Array.isArray(forms) ? forms.length : 0;

    const filings: Filing[] = [];
    let insiderRecentCount = 0;
    for (let i = 0; i < n; i++) {
      const form = strAt(forms, i);
      if (form === "4") insiderRecentCount++;
      if (!FORMS.has(form)) continue;
      if (filings.length >= 8) continue;
      const accNoDashes = strAt(accs, i).replace(/-/g, "");
      const primaryDocument = strAt(docs, i);
      const url_ = `https://www.sec.gov/Archives/edgar/data/${hit.cik}/${accNoDashes}/${primaryDocument}`;
      filings.push({ form, date: strAt(dates, i), url: url_ });
    }

    return json({
      symbol,
      cik: hit.cik,
      name: hit.name,
      filings,
      insiderRecentCount,
    }, { headers: { "cache-control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (e) {
    return json(
      { error: `failed to load filings ${symbol}: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
