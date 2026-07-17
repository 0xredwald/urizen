import { NextResponse } from "next/server";

// Public, agent-facing JSON. CORS-open so other agents (Bankr, MCP clients) can read
// the fund's live state cross-origin.
export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
      // CDN-cache reads so popular repeat queries serve from the edge without re-invoking the
      // function (cuts Vercel cost from external agents); stale-while-revalidate keeps it snappy.
      // Slow-moving routes (fundamentals/filings/macro) override this with a longer s-maxage.
      "cache-control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
      ...(init?.headers ?? {}),
    },
  });
}

export function options() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
