import { NextResponse } from "next/server";

// Urizen Free Mode proxy. Holds our OpenRouter key (env URIZEN_FREE_OPENROUTER_KEY) so users can
// try Alpha with zero setup. Free OpenRouter models are shared and rate-limit hard, so we try a
// pool of free, tool-capable models from DIFFERENT providers and stream back the first that works.
export const runtime = "edge";
export const dynamic = "force-dynamic";

const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";

// free + tool-capable, spread across providers so one provider's rate-limit doesn't block everything.
// The client's chosen model is tried first, then these as fallbacks.
const FREE_POOL = [
  "openai/gpt-oss-20b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];
const FREE_ALLOW = new Set(FREE_POOL);
const RETRYABLE = new Set([429, 502, 503, 500, 408]);

function crossOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = new URL(origin).host;
    // allow the site, local dev, and our own Vercel preview/staging deploys (branch previews)
    return !(host === "urizenfund.com" || host.endsWith(".urizenfund.com") || host.endsWith(".vercel.app") || host === "localhost" || host.startsWith("localhost:") || host === "127.0.0.1" || host.startsWith("127.0.0.1:"));
  } catch { return true; }
}

export async function POST(req: Request) {
  if (crossOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const key = process.env.URIZEN_FREE_OPENROUTER_KEY;
  if (!key) return NextResponse.json({ error: "free mode not configured", detail: "URIZEN_FREE_OPENROUTER_KEY is not set." }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }

  // ordered model list: the client's pick first (if it's a free model), then the rest of the pool
  const requested = String(body.model || "");
  const models = [
    ...(FREE_ALLOW.has(requested) ? [requested] : []),
    ...FREE_POOL.filter((m) => m !== requested),
  ];

  const base = { ...body, max_tokens: Math.min(Number(body.max_tokens) || 1200, 1200), stream: true } as Record<string, unknown>;
  delete base.models;

  let lastStatus = 502;
  let lastDetail = "";
  for (const model of models) {
    let upstream: Response;
    try {
      upstream = await fetch(OPENROUTER, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "http-referer": "https://urizenfund.com", "x-title": "Urizen Alpha (Free Mode)" },
        body: JSON.stringify({ ...base, model }),
      });
    } catch (e) { lastDetail = (e as Error).message; lastStatus = 502; continue; }

    if (upstream.ok && upstream.body) {
      return new Response(upstream.body, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" } });
    }
    lastStatus = upstream.status;
    lastDetail = (await upstream.text().catch(() => "")).slice(0, 200);
    if (!RETRYABLE.has(upstream.status)) break; // a non-transient error (e.g. 401 bad key) — stop trying
  }

  const msg = lastStatus === 401
    ? "Free mode key is invalid — set a valid URIZEN_FREE_OPENROUTER_KEY."
    : "Free models are busy right now. Retry in a moment, or add your own key for higher limits.";
  return NextResponse.json({ error: msg, status: lastStatus, detail: lastDetail }, { status: 503 });
}
