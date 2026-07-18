import crypto from "node:crypto";

// Durable per-chat state for the Telegram bot — replaces the in-memory Maps that evaporated on every
// serverless cold start (the "loses memory / paste key → /start again / wallet not detected" bugs).
// State lives in a locked remote store reached only through secret-guarded RPC calls, so the public
// read key can't touch it directly. The BYOK AI key is AES-256-GCM encrypted at rest. If the store
// isn't configured we fall back to an in-memory Map (old behaviour, no crash). All connection details
// come from env — nothing about the store is hard-coded here.

const URL = process.env.BOT_DB_URL;
const KEY = process.env.BOT_DB_KEY;
const SECRET = process.env.BOT_DB_SECRET;
export const dbEnabled = !!(URL && KEY && SECRET);

const encKey = () => crypto.createHash("sha256").update(process.env.BOT_KEY_SECRET || "urizen-dev-key").digest();
function enc(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}
function dec(s: string): string | undefined {
  try {
    const [iv, tag, ct] = s.split(":");
    const d = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
  } catch { return undefined; }
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY!, authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`rpc ${fn} ${r.status}`);
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

export type BotState = { provider?: string; key?: string; model?: string; skills?: string[]; wallet?: string };
const mem = new Map<number, BotState>(); // fallback when DB is unconfigured

export async function getState(chatId: number): Promise<BotState> {
  if (!dbEnabled) return mem.get(chatId) ?? {};
  try {
    const row = (await rpc("urizen_bot_get", { p_secret: SECRET, p_chat: chatId })) as
      | { provider?: string; ai_key_enc?: string; model?: string; skills?: string[]; wallet?: string }
      | null;
    if (!row) return {};
    return {
      provider: row.provider ?? undefined,
      key: row.ai_key_enc ? dec(row.ai_key_enc) : undefined,
      model: row.model ?? undefined,
      skills: row.skills ?? undefined,
      wallet: row.wallet ?? undefined,
    };
  } catch { return mem.get(chatId) ?? {}; }
}

export async function setLlm(chatId: number, providerId: string, key: string, model: string): Promise<void> {
  if (!dbEnabled) { mem.set(chatId, { ...(mem.get(chatId) ?? {}), provider: providerId, key, model }); return; }
  try { await rpc("urizen_bot_upsert", { p_secret: SECRET, p_chat: chatId, p_patch: { provider: providerId, ai_key_enc: enc(key), model } }); }
  catch { mem.set(chatId, { ...(mem.get(chatId) ?? {}), provider: providerId, key, model }); }
}

export async function setModel(chatId: number, model: string): Promise<void> {
  if (!dbEnabled) { const s = mem.get(chatId); if (s) s.model = model; return; }
  try { await rpc("urizen_bot_upsert", { p_secret: SECRET, p_chat: chatId, p_patch: { model } }); } catch { /* */ }
}

export async function setSkills(chatId: number, skills: string[]): Promise<void> {
  if (!dbEnabled) { mem.set(chatId, { ...(mem.get(chatId) ?? {}), skills }); return; }
  try { await rpc("urizen_bot_upsert", { p_secret: SECRET, p_chat: chatId, p_patch: { skills } }); } catch { /* */ }
}

export async function setWallet(chatId: number, wallet: string): Promise<void> {
  if (!dbEnabled) { mem.set(chatId, { ...(mem.get(chatId) ?? {}), wallet }); return; }
  try { await rpc("urizen_bot_upsert", { p_secret: SECRET, p_chat: chatId, p_patch: { wallet } }); } catch { /* */ }
}

export async function clearAi(chatId: number): Promise<void> {
  if (!dbEnabled) { const s = mem.get(chatId); if (s) { s.provider = s.key = s.model = undefined; } return; }
  try { await rpc("urizen_bot_clear", { p_secret: SECRET, p_chat: chatId, p_what: "ai" }); } catch { /* */ }
}

// A short HMAC over the chat id so the connect page can prove which chat it's linking a wallet for
// (the page can't forge an arbitrary chat → wallet link without the secret).
export function tgLinkSig(chatId: number): string {
  return crypto.createHmac("sha256", SECRET || "urizen-dev").update(String(chatId)).digest("hex").slice(0, 24);
}
export function verifyTgLink(chatId: number, sig: string): boolean {
  const expected = tgLinkSig(chatId);
  return typeof sig === "string" && sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
