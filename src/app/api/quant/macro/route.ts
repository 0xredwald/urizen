import { json, options } from "@/lib/api";

// Keyless macro desk: current rate levels + the upcoming high-impact US economic calendar.
// Fed funds ← NY Fed markets API (EFFR). CPI + unemployment ← BLS public API v1 (keyless).
// 10Y yield ← Yahoo ^TNX. Calendar (with forecast/previous/actual) ← ForexFactory weekly feed
// (faireconomy). Every source is public + no-key; each fetch is independently cached and any
// one failing just drops its field. Nothing here needs an env secret.
export const revalidate = 0;

const UA = "Mozilla/5.0 (compatible; urizen-quant/1.0)";
const num = (x: unknown): number | null => { const n = typeof x === "string" ? parseFloat(x) : typeof x === "number" ? x : NaN; return Number.isFinite(n) ? n : null; };

export function OPTIONS() {
  return options();
}

type Rate = { label: string; value: string; detail?: string };
type Event = { date: string; title: string; impact: string; forecast: string | null; previous: string | null; actual: string | null };

// Fed funds — NY Fed effective rate + the current target range.
async function fedFunds(): Promise<Rate | null> {
  try {
    const r = await fetch("https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json", { headers: { "User-Agent": UA }, next: { revalidate: 3600 } });
    if (!r.ok) return null;
    const d = await r.json() as { refRates?: { percentRate?: number; targetRateFrom?: number; targetRateTo?: number }[] };
    const x = d.refRates?.[0];
    if (!x || x.percentRate == null) return null;
    return { label: "Fed funds", value: `${x.percentRate.toFixed(2)}%`, detail: x.targetRateFrom != null ? `target ${x.targetRateFrom.toFixed(2)}–${x.targetRateTo?.toFixed(2)}%` : undefined };
  } catch { return null; }
}

// BLS series (keyless v1). CPI reports YoY off the same series; unemployment is a level.
async function bls(seriesId: string): Promise<{ latest: number; periodName: string; year: string; yearAgo: number | null } | null> {
  try {
    const r = await fetch(`https://api.bls.gov/publicAPI/v1/timeseries/data/${seriesId}`, { headers: { "User-Agent": UA }, next: { revalidate: 21600 } });
    if (!r.ok) return null;
    const d = await r.json() as { Results?: { series?: { data?: { value?: string; periodName?: string; year?: string; period?: string }[] }[] } };
    const rows = d.Results?.series?.[0]?.data ?? [];
    if (!rows.length) return null;
    const top = rows[0];
    const latest = num(top.value);
    if (latest == null) return null;
    const prior = rows.find((x) => x.period === top.period && x.year === String(Number(top.year) - 1));
    return { latest, periodName: top.periodName ?? "", year: top.year ?? "", yearAgo: prior ? num(prior.value) : null };
  } catch { return null; }
}

async function tenYear(): Promise<Rate | null> {
  try {
    const r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?range=1d&interval=1d", { headers: { "User-Agent": UA }, next: { revalidate: 300 } });
    if (!r.ok) return null;
    const d = await r.json() as { chart?: { result?: { meta?: { regularMarketPrice?: number } }[] } };
    const p = d.chart?.result?.[0]?.meta?.regularMarketPrice;
    return p == null ? null : { label: "US 10Y", value: `${p.toFixed(2)}%` };
  } catch { return null; }
}

// ForexFactory calendar (via faireconomy): US prints with consensus, THIS week + NEXT week so the
// report has both today's releases and what's coming. Keeps High/Medium impact.
async function calendar(): Promise<Event[]> {
  const feeds = ["ff_calendar_thisweek.json", "ff_calendar_nextweek.json"];
  const blank = (s?: string) => (s && s.trim() ? s : null);
  const raw = (await Promise.all(feeds.map(async (f) => {
    try {
      const r = await fetch(`https://nfs.faireconomy.media/${f}`, { headers: { "User-Agent": UA }, next: { revalidate: 1800 } });
      return r.ok ? (await r.json() as { title?: string; country?: string; date?: string; impact?: string; forecast?: string; previous?: string; actual?: string }[]) : [];
    } catch { return []; }
  }))).flat();
  return raw
    .filter((e) => e.country === "USD" && (e.impact === "High" || e.impact === "Medium"))
    .map((e) => ({ date: e.date ?? "", title: e.title ?? "", impact: e.impact ?? "", forecast: blank(e.forecast), previous: blank(e.previous), actual: blank(e.actual) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 24);
}

export async function GET() {
  const [ff, cpi, unemp, ten, cal] = await Promise.all([fedFunds(), bls("CUUR0000SA0"), bls("LNS14000000"), tenYear(), calendar()]);

  const rates: Rate[] = [];
  if (ff) rates.push(ff);
  if (cpi) {
    const yoy = cpi.yearAgo ? ((cpi.latest / cpi.yearAgo - 1) * 100) : null;
    rates.push({ label: "CPI (YoY)", value: yoy != null ? `${yoy.toFixed(1)}%` : cpi.latest.toFixed(1), detail: `${cpi.periodName} ${cpi.year}` });
  }
  if (unemp) rates.push({ label: "Unemployment", value: `${unemp.latest.toFixed(1)}%`, detail: `${unemp.periodName} ${unemp.year}` });
  if (ten) rates.push(ten);

  return json({ rates, calendar: cal, source: "NY Fed · BLS · Yahoo · ForexFactory" }, { headers: { "cache-control": "public, max-age=600, s-maxage=900, stale-while-revalidate=3600" } });
}
