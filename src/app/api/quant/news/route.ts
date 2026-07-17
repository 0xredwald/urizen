import { json, options } from "@/lib/api";
import { bySymbol } from "@/lib/stocks";

// Real financial headlines for the tokenized-equity underlyings, proxied server-side from
// Yahoo's public RSS feed (keyless). Yahoo blocks browser cross-origin reads, so the studio
// only ever sees the normalized item list. Cached a few minutes so the console feels live.
export const revalidate = 0;

type NewsItem = { title: string; url: string; publishedAt: string; source: string };

const UA = "Mozilla/5.0 (compatible; urizen-quant/1.0)";

export function OPTIONS() {
  return options();
}

// Strip CDATA wrappers and decode the handful of XML entities Yahoo emits.
function clean(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? clean(m[1]) : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("symbol");
  const symbol = raw ? raw.replace(/^\$/, "").toUpperCase() : "";

  // With no symbol we fall back to the broad market (S&P 500 headlines). Known instruments,
  // $URI/URIZEN, and the "general" keyword are all accepted; unknown symbols still get tried.
  let feedSymbol = "^GSPC";
  if (symbol && symbol !== "GENERAL") {
    if (symbol === "URI" || symbol === "URIZEN") {
      feedSymbol = "URI";
    } else {
      feedSymbol = symbol;
    }
  }

  const upstream = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
    feedSymbol,
  )}&region=US&lang=en-US`;

  try {
    const res = await fetch(upstream, {
      headers: { "User-Agent": UA },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const xml = await res.text();

    const items: NewsItem[] = [];
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
    for (const block of blocks) {
      const title = tag(block, "title");
      const link = tag(block, "link");
      if (!title || !link) continue;
      items.push({
        title,
        url: link,
        publishedAt: tag(block, "pubDate") ?? "",
        source: "Yahoo Finance",
      });
      if (items.length >= 12) break;
    }

    return json({
      symbol: symbol && symbol !== "GENERAL" ? (bySymbol(symbol)?.symbol ?? symbol) : "general",
      items,
    });
  } catch (e) {
    return json(
      { error: `failed to load news: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
