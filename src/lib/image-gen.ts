// AI image generation for the bot. In DMs it runs on the *user's* key (Gemini direct, or an image
// model via their OpenRouter key); in our own group/channel it may use our optional GEMINI_API_KEY.
// If no image key is available it falls back to the branded Urizen card (/api/og/card, free, no key).
// Images get a light Urizen style hint so they feel on-brand. Returns PNG bytes (base64) or null.

const STYLE = "Style: cinematic, dark, a William Blake engraving crossed with a neon-green (#34F003) terminal aesthetic — moody, high-contrast, editorial. Subject:";

export type GenImage = { base64: string; mime: string };

// Gemini's native generateContent, given any key (a user's or ours).
export async function aiImageGemini(key: string, prompt: string, model = "gemini-2.5-flash-image"): Promise<GenImage | null> {
  if (!key) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${STYLE} ${prompt}` }] }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } }),
    });
    if (!res.ok) return null;
    const d = await res.json() as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
    for (const p of d.candidates?.[0]?.content?.parts || []) {
      if (p.inlineData?.data) return { base64: p.inlineData.data, mime: p.inlineData.mimeType || "image/png" };
    }
    return null;
  } catch { return null; }
}

// An image model through OpenRouter (chat/completions with image modality), on the user's key.
export async function aiImageOpenRouter(key: string, prompt: string, model = "google/gemini-2.5-flash-image"): Promise<GenImage | null> {
  if (!key) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "http-referer": "https://urizenfund.com", "x-title": "Urizen Alpha" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: `${STYLE} ${prompt}` }], modalities: ["image", "text"] }),
    });
    if (!res.ok) return null;
    const d = await res.json() as { choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[] };
    const url = d.choices?.[0]?.message?.images?.[0]?.image_url?.url || "";
    const m = url.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    return m ? { base64: m[2], mime: m[1] } : null;
  } catch { return null; }
}

// Our own key path — used only for our group/channel surface, never in DMs.
export async function aiImage(prompt: string): Promise<GenImage | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return aiImageGemini(key, prompt, process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image");
}

// The always-available branded card URL for a prompt/headline (no key needed).
export function cardUrl(base: string, opts: { tag?: string; title: string; sub?: string }): string {
  const q = new URLSearchParams();
  if (opts.tag) q.set("tag", opts.tag);
  q.set("title", opts.title);
  if (opts.sub) q.set("sub", opts.sub);
  return `${base}/api/og/card?${q.toString()}`;
}
