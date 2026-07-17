import { json, options } from "@/lib/api";
import { bySymbol } from "@/lib/stocks";

// Real financial headlines. Primary source: Finnhub (company-news per symbol, or general market
// news) using FINNHUB_API_KEY — reliable, with images + summaries. Falls back to Yahoo's RSS feed
// (keyless) if the key is missing or Finnhub returns nothing. Server-side proxy; CORS-open JSON.
export const revalidate = 0;

type NewsItem = { title: string; url: string; publishedAt: string; source: string; image?: string; summary?: string };

const UA = "Mozilla/5.0 (compatible; urizen-quant/1.0)";

export function OPTIONS() {
  return options();
}

function clean(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .trim();
}
function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? clean(m[1]) : null;
}

type FinnhubNews = { headline?: string; url?: string; datetime?: number; source?: string; image?: string; summary?: string };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("symbol");
  const symbol = raw ? raw.replace(/^\$/, "").toUpperCase() : "";
  const isMarket = !symbol || symbol === "GENERAL" || symbol === "MARKET";
  const outSymbol = isMarket ? "general" : (bySymbol(symbol)?.symbol ?? symbol);

  // ── 1) Finnhub (preferred) ──────────────────────────────────────────────
  const key = process.env.FINNHUB_API_KEY;
  if (key) {
    try {
      let upstream: string;
      if (isMarket) {
        upstream = `https://finnhub.io/api/v1/news?category=general&token=${key}`;
      } else {
        const pad = (n: number) => String(n).padStart(2, "0");
        const d = (t: number) => { const x = new Date(t); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`; };
        const now = Date.now();
        upstream = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${d(now - 21 * 864e5)}&to=${d(now)}&token=${key}`;
      }
      const res = await fetch(upstream, { next: { revalidate: 300 } });
      if (res.ok) {
        const arr = (await res.json()) as FinnhubNews[];
        if (Array.isArray(arr) && arr.length) {
          const items: NewsItem[] = arr
            .filter((n) => n.headline && n.url)
            .sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0))
            .slice(0, 24)
            .map((n) => ({
              title: n.headline as string,
              url: n.url as string,
              publishedAt: n.datetime ? new Date(n.datetime * 1000).toISOString() : "",
              source: n.source || "Finnhub",
              image: n.image || undefined,
              summary: n.summary || undefined,
            }));
          if (items.length) return json({ symbol: outSymbol, items });
        }
      }
    } catch { /* fall through to Yahoo */ }
  }

  // ── 2) Yahoo RSS fallback ───────────────────────────────────────────────
  const feedSymbol = isMarket ? "^GSPC" : (symbol === "URI" || symbol === "URIZEN" ? "URI" : symbol);
  const upstream = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(feedSymbol)}&region=US&lang=en-US`;
  try {
    const res = await fetch(upstream, { headers: { "User-Agent": UA }, next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const xml = await res.text();
    const items: NewsItem[] = [];
    for (const block of xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []) {
      const title = tag(block, "title"), link = tag(block, "link");
      if (!title || !link) continue;
      items.push({ title, url: link, publishedAt: tag(block, "pubDate") ?? "", source: "Yahoo Finance" });
      if (items.length >= 16) break;
    }
    return json({ symbol: outSymbol, items });
  } catch (e) {
    return json({ symbol: outSymbol, items: [], error: `failed to load news: ${(e as Error).message}` }, { status: 200 });
  }
}
