import { NextResponse } from "next/server";

// BYOK chat proxy. The browser can't call OpenAI directly (no CORS) and mis-routing an OpenAI key to
// OpenRouter fails — so ALL bring-your-own-key requests go through here. We forward the user's key to
// the correct provider server-side and stream the response straight back. We NEVER store or log the key.
//
// Providers: `anthropic` (x-api-key, Anthropic Messages), everything else is OpenAI-compatible
// (`openai`, `openrouter`, and — since OpenRouter is one key to every lab — Gemini/Grok/DeepSeek/…).
export const runtime = "edge";
export const dynamic = "force-dynamic";

const OPENAI_COMPAT: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  xai: "https://api.x.ai/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
};
const ANTHROPIC = "https://api.anthropic.com/v1/messages";

function crossOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = new URL(origin).host;
    return !(host === "urizenfund.com" || host.endsWith(".urizenfund.com") || host.endsWith(".vercel.app") || host === "localhost" || host.startsWith("localhost:") || host === "127.0.0.1" || host.startsWith("127.0.0.1:"));
  } catch { return true; }
}

function errFrom(text: string, status: number, provider: string): string {
  try { const j = JSON.parse(text); return j?.error?.message || j?.error || j?.message || `${provider} ${status}`; }
  catch { return text.slice(0, 200) || `${provider} ${status}`; }
}

type Body = { provider?: string; key?: string; model?: string; system?: string; messages?: { role: string; content: string }[] };

export async function POST(req: Request) {
  if (crossOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }

  const provider = String(body.provider || "openrouter");
  const key = (body.key || "").trim();
  const model = body.model || "";
  const system = body.system || "";
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!key) return NextResponse.json({ error: "no key" }, { status: 400 });
  if (!model) return NextResponse.json({ error: "no model" }, { status: 400 });

  const stream = (upstream: Response) =>
    new Response(upstream.body, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" } });

  try {
    if (provider === "anthropic") {
      const up = await fetch(ANTHROPIC, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 3000, stream: true, ...(system ? { system } : {}), messages }),
      });
      if (!up.ok || !up.body) { const t = await up.text().catch(() => ""); return NextResponse.json({ error: errFrom(t, up.status, "anthropic"), status: up.status }, { status: 502 }); }
      return stream(up);
    }

    const base = OPENAI_COMPAT[provider] || OPENAI_COMPAT.openai;
    const msgs = system ? [{ role: "system", content: system }, ...messages] : messages;
    const up = await fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "http-referer": "https://urizenfund.com", "x-title": "URIZEN Terminal · Agent" },
      body: JSON.stringify({ model, max_tokens: 3000, stream: true, messages: msgs }),
    });
    if (!up.ok || !up.body) { const t = await up.text().catch(() => ""); return NextResponse.json({ error: errFrom(t, up.status, provider), status: up.status }, { status: 502 }); }
    return stream(up);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "proxy error" }, { status: 502 });
  }
}
