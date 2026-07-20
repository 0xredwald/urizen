import { json, options } from "@/lib/api";

// Prediction-market odds from Polymarket's public gamma API (keyless). We search events, then
// read each event's most-liquid market and surface the market-implied probability of its
// leading outcome. Real-money odds — a useful cross-check on macro/event narratives.
export const revalidate = 0;

const UA = "Mozilla/5.0 (compatible; urizen-quant/1.0)";

export function OPTIONS() {
  return options();
}

const jparse = (s: unknown): string[] => { if (Array.isArray(s)) return s as string[]; if (typeof s === "string") { try { const p = JSON.parse(s); return Array.isArray(p) ? p : []; } catch { return []; } } return []; };
const numish = (x: unknown): number | null => { const n = typeof x === "string" ? parseFloat(x) : typeof x === "number" ? x : NaN; return Number.isFinite(n) ? n : null; };

type Mkt = { outcomes?: unknown; outcomePrices?: unknown; volume?: unknown; volumeNum?: unknown; liquidity?: unknown; question?: string; groupItemTitle?: string };
type Ev = { title?: string; slug?: string; volume?: unknown; closed?: boolean; markets?: Mkt[] };

// The "Yes" probability of a market (or its leading outcome if it isn't a Yes/No market).
function yesProb(m: Mkt): number {
  const outcomes = jparse(m.outcomes);
  const prices = jparse(m.outcomePrices).map((p) => numish(p) ?? 0);
  if (!prices.length) return 0;
  const yi = outcomes.findIndex((o) => /^yes$/i.test(o));
  if (yi >= 0) return prices[yi];
  return Math.max(...prices);
}

type TopMkt = { question?: string; outcomes?: unknown; outcomePrices?: unknown; volume24hr?: unknown; volumeNum?: unknown; volume?: unknown; liquidity?: unknown; groupItemTitle?: string; slug?: string; events?: { slug?: string }[]; closed?: boolean; active?: boolean };

// No query → the highest-volume live markets right now (the "odds board"). Always populated, so the
// terminal's odds section is never empty. Real-money, keyless (Polymarket gamma /markets).
async function topMarkets() {
  const r = await fetch(
    "https://gamma-api.polymarket.com/markets?closed=false&active=true&order=volume24hr&ascending=false&limit=40",
    { headers: { "User-Agent": UA }, next: { revalidate: 120 } },
  );
  if (!r.ok) throw new Error(`polymarket ${r.status}`);
  const arr = (await r.json()) as TopMkt[];
  const markets = (Array.isArray(arr) ? arr : [])
    .filter((m) => !m.closed && jparse(m.outcomePrices).length >= 2)
    .map((m) => {
      const prob = yesProb(m);
      const yi = jparse(m.outcomes).findIndex((o) => /^yes$/i.test(o));
      const outcome = yi >= 0 ? "Yes" : (m.groupItemTitle || "leading");
      const slug = m.events?.[0]?.slug || m.slug;
      return {
        question: m.question || "",
        probability: prob,
        outcome,
        volumeUsd: numish(m.volume24hr) ?? numish(m.volumeNum) ?? numish(m.volume),
        url: slug ? `https://polymarket.com/event/${slug}` : "https://polymarket.com",
      };
    })
    .filter((m) => m.question && m.probability != null && m.probability < 0.985 && m.probability > 0.015)
    .sort((a, b) => (b.volumeUsd ?? 0) - (a.volumeUsd ?? 0))
    .slice(0, 12);
  return markets;
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (!q) {
    try {
      const markets = await topMarkets();
      return json({ query: "", markets, source: "Polymarket" }, { headers: { "cache-control": "public, max-age=120, s-maxage=300, stale-while-revalidate=1800" } });
    } catch (e) {
      return json({ error: `failed to load predictions: ${(e as Error).message}` }, { status: 502 });
    }
  }

  try {
    const r = await fetch(`https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(q)}&limit_per_type=10`, {
      headers: { "User-Agent": UA }, next: { revalidate: 300 },
    });
    if (!r.ok) throw new Error(`polymarket ${r.status}`);
    const d = await r.json() as { events?: Ev[] };
    const events = (Array.isArray(d.events) ? d.events : []).filter((e) => !e.closed);

    const markets = events.map((ev) => {
      const ms = (Array.isArray(ev.markets) ? ev.markets : []).filter((m) => jparse(m.outcomePrices).length > 0);
      if (!ms.length) return null;
      const grouped = ms.length > 1 && ms.some((m) => m.groupItemTitle);
      // Grouped (mutually-exclusive) event → the most-likely outcome across its sub-markets.
      // Binary event → the single market's Yes probability.
      let best: Mkt | null = null, bestYes = -1;
      for (const m of ms) { const y = yesProb(m); if (y > bestYes) { bestYes = y; best = m; } }
      if (!best) return null;
      const outcome = grouped ? (best.groupItemTitle || "leading") : "Yes";
      const volumeUsd = numish(ev.volume) ?? numish(best.volumeNum) ?? numish(best.volume);
      return {
        question: ev.title || best.question || "",
        probability: Number.isFinite(bestYes) ? bestYes : null,
        outcome,
        volumeUsd,
        url: ev.slug ? `https://polymarket.com/event/${ev.slug}` : "https://polymarket.com",
      };
    }).filter((m): m is NonNullable<typeof m> => m !== null && !!m.question && m.probability != null && m.probability < 0.995 && m.probability > 0.005)
      .sort((a, b) => (b.volumeUsd ?? 0) - (a.volumeUsd ?? 0))
      .slice(0, 8);

    return json({ query: q, markets, source: "Polymarket" }, { headers: { "cache-control": "public, max-age=120, s-maxage=300, stale-while-revalidate=1800" } });
  } catch (e) {
    return json({ error: `failed to load predictions: ${(e as Error).message}` }, { status: 502 });
  }
}
