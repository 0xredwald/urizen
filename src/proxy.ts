import { NextResponse, type NextRequest } from "next/server";

// Cost guard for our public, CORS-open API. The paid keys (LLM, Rialto) are already
// same-origin locked; this caps Vercel invocation cost from external agents hammering the
// keyless read routes. Generous per-IP sliding window — a real research agent never nears it.
// Best-effort (in-memory, per edge instance); the authoritative cap is the Vercel Firewall
// rate-limit rule at the edge, which blocks before a request becomes a billable invocation.
// (Next 16 "proxy" convention — the renamed successor to middleware.)
const LIMIT = 300;           // requests
const WINDOW_MS = 60_000;    // per minute, per IP

const hits = new Map<string, number[]>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  // opportunistic cleanup so the map can't grow unbounded on a long-lived instance
  if (hits.size > 5000) for (const [k, v] of hits) if (v[v.length - 1] < now - WINDOW_MS) hits.delete(k);
  return arr.length > LIMIT;
}

export function proxy(req: NextRequest) {
  // the Telegram webhook is auth'd by its own secret and comes from a few Telegram IPs — don't
  // rate-limit it (a busy bot would otherwise get its users' messages dropped).
  if (req.nextUrl.pathname.startsWith("/api/telegram")) return NextResponse.next();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  if (tooMany(ip)) {
    return NextResponse.json(
      { error: "rate limit exceeded — slow down (300 req/min per IP)" },
      { status: 429, headers: { "retry-after": "30", "access-control-allow-origin": "*" } },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
