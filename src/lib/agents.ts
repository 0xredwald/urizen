// The agent layer — deliberately DB-less. Agent configs live in the browser (localStorage);
// the intelligence key lives only in the browser and is sent straight to the user's model
// provider, never to a URIZEN server. The store is behind a tiny interface so it can be
// swapped for CTRL's Supabase (keyed by wallet) later without touching the UI.

import type { Indicators } from "./quant";

export type Mandate = "DCA" | "Momentum" | "Rotation" | "Yield" | "Hedge";
export type Risk = "conservative" | "balanced" | "aggressive";

export type Agent = {
  id: string;
  name: string;
  mandate: Mandate;
  instruments: string[]; // stock symbols
  risk: Risk;
  note?: string;
  createdAt: number;
  owner?: string; // wallet address that forged it
};

// ── persistence (swappable) ──────────────────────────────────────────────
const AGENTS_KEY = "urizen.agents.v1";
const KEY_VAULT = "urizen.aikey.v1";

const canStore = () => typeof window !== "undefined";

export function listAgents(): Agent[] {
  if (!canStore()) return [];
  try {
    return JSON.parse(localStorage.getItem(AGENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveAgent(a: Agent): Agent[] {
  const all = listAgents().filter((x) => x.id !== a.id);
  all.unshift(a);
  localStorage.setItem(AGENTS_KEY, JSON.stringify(all));
  return all;
}

export function deleteAgent(id: string): Agent[] {
  const all = listAgents().filter((x) => x.id !== id);
  localStorage.setItem(AGENTS_KEY, JSON.stringify(all));
  return all;
}

export function newId() {
  return `agt_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

// ── the intelligence keys (browser-only, multi-provider) ──────────────────
export type Provider = "anthropic" | "openai" | "openrouter";

export type KeyBinding = { provider: Provider; key: string; model?: string; free?: boolean };

// Urizen Free Mode: no user key — requests go through our server proxy (/api/alpha/free) which
// holds the OpenRouter key (env URIZEN_FREE_OPENROUTER_KEY) and only runs a free model.
export const FREE_MODEL = "openai/gpt-oss-20b:free";

type Vault = { keys: Partial<Record<Provider, string>>; active?: Provider; model?: string };

// ── encrypted-at-rest storage ────────────────────────────────────────────
// API keys are stored ENCRYPTED (AES-GCM) under a NON-EXTRACTABLE Web Crypto key held in IndexedDB.
// The ciphertext lives in localStorage; the decrypt key can never be exported, so a stolen copy of
// localStorage, a disk/profile-sync backup, or a devtools peek can't recover the key. Keys are
// decrypted only into memory for the session. (Active XSS on this origin could still read a live
// decrypted key — inherent to any browser BYOK — which is exactly why keys are sent only to the
// model provider, never to a Urizen server.)
const VAULT_ENC = "urizen.keys.v3.enc";
const VAULT_V2 = "urizen.keys.v2"; // legacy plaintext — migrated then purged on first unlock
const SECURE_DB = "urizen-secure", SECURE_STORE = "kv", SECURE_KEYID = "vault-key-v1";

let cache: Vault | null = null; // in-memory, decrypted; populated by unlockVault()
let cryptoReady = false;        // false → crypto/IDB unavailable, degrade to plaintext

export function detectProvider(key: string): Provider {
  const k = key.trim();
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("sk-ant-")) return "anthropic";
  return "openai";
}

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(SECURE_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(SECURE_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}
// get-or-create the non-extractable AES key (stored as a live CryptoKey in IndexedDB, never as raw bytes)
async function vaultKey(): Promise<CryptoKey> {
  const db = await idbOpen();
  const existing = await idbReq(db.transaction(SECURE_STORE, "readonly").objectStore(SECURE_STORE).get(SECURE_KEYID)) as CryptoKey | undefined;
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await idbReq(db.transaction(SECURE_STORE, "readwrite").objectStore(SECURE_STORE).put(key, SECURE_KEYID));
  return key;
}
async function encryptStr(plain: string): Promise<string> {
  const key = await vaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + ct.length); out.set(iv); out.set(ct, iv.length);
  let s = ""; for (const b of out) s += String.fromCharCode(b);
  return btoa(s);
}
async function decryptStr(blob: string): Promise<string> {
  const key = await vaultKey();
  const raw = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, key, raw.slice(12));
  return new TextDecoder().decode(pt);
}

/** Load + decrypt the vault into memory. MUST be awaited before reading keys (the UI gates on it).
 *  Migrates any legacy plaintext vault to encrypted storage and purges the plaintext copy. */
export async function unlockVault(): Promise<void> {
  if (!canStore()) { cache = { keys: {} }; return; }
  cryptoReady = typeof crypto !== "undefined" && !!crypto.subtle && typeof indexedDB !== "undefined";
  try {
    if (cryptoReady) {
      const enc = localStorage.getItem(VAULT_ENC);
      if (enc) { cache = JSON.parse(await decryptStr(enc)); return; }
      const legacy2 = localStorage.getItem(VAULT_V2);
      if (legacy2) { cache = JSON.parse(legacy2); await persist(); localStorage.removeItem(VAULT_V2); return; }
      const legacy1 = localStorage.getItem(KEY_VAULT);
      if (legacy1) { const b = JSON.parse(legacy1) as KeyBinding; cache = { keys: { [b.provider]: b.key }, active: b.provider, model: b.model }; await persist(); localStorage.removeItem(KEY_VAULT); return; }
      cache = { keys: {} };
      return;
    }
  } catch { /* fall through to plaintext */ }
  try { cache = JSON.parse(localStorage.getItem(VAULT_V2) || '{"keys":{}}'); } catch { cache = { keys: {} }; }
}

async function persist(): Promise<void> {
  if (!canStore() || !cache) return;
  try {
    if (cryptoReady) { localStorage.setItem(VAULT_ENC, await encryptStr(JSON.stringify(cache))); localStorage.removeItem(VAULT_V2); }
    else localStorage.setItem(VAULT_V2, JSON.stringify(cache));
  } catch { /* best effort */ }
}

function readVault(): Vault { return cache ?? { keys: {} }; }
function writeVault(v: Vault) { cache = v; void persist(); }

/** Wipe every stored key + the encryption key itself (a real "forget me"). */
export async function purgeVault(): Promise<void> {
  cache = { keys: {} };
  if (!canStore()) return;
  try { localStorage.removeItem(VAULT_ENC); localStorage.removeItem(VAULT_V2); localStorage.removeItem(KEY_VAULT); } catch { /* noop */ }
  try { const db = await idbOpen(); await idbReq(db.transaction(SECURE_STORE, "readwrite").objectStore(SECURE_STORE).delete(SECURE_KEYID)); } catch { /* noop */ }
}

/** Providers that currently have a key, with the last 4 chars for display. */
export function listProviderKeys(): { provider: Provider; last4: string }[] {
  const v = readVault();
  return (Object.keys(v.keys) as Provider[]).filter((p) => v.keys[p]).map((p) => ({ provider: p, last4: (v.keys[p] as string).slice(-4) }));
}

/** Add/replace a key; the provider is detected from the key. Becomes active if none is. */
export function addProviderKey(key: string): Provider {
  const provider = detectProvider(key);
  const v = readVault();
  v.keys[provider] = key.trim();
  if (!v.active) v.active = provider;
  writeVault(v);
  return provider;
}

export function removeProviderKey(p: Provider) {
  const v = readVault();
  delete v.keys[p];
  if (v.active === p) v.active = (Object.keys(v.keys) as Provider[]).find((x) => v.keys[x]);
  writeVault(v);
}

export function setActiveProvider(p: Provider, model?: string) {
  const v = readVault();
  if (!v.keys[p]) return;
  v.active = p;
  if (model !== undefined) v.model = model || undefined;
  writeVault(v);
}

export function getActiveProvider(): Provider | null {
  return readVault().active ?? null;
}

export function getActiveModel(): string | undefined {
  return readVault().model;
}

export function setModel(model: string) {
  const v = readVault();
  v.model = model || undefined;
  writeVault(v);
}

/** Selectable models per provider (research). The active provider's key is used.
 *  `free: true` costs nothing to run (OpenRouter free tier) — the default for OpenRouter. */
export type ModelInfo = { id: string; label: string; free?: boolean; brand: string };
export const MODELS: Record<Provider, ModelInfo[]> = {
  anthropic: [
    { id: "claude-opus-4-8", label: "Claude Opus 4.8", brand: "anthropic" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", brand: "anthropic" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", brand: "anthropic" },
  ],
  openai: [
    { id: "gpt-5", label: "GPT-5", brand: "openai" },
    { id: "gpt-5-mini", label: "GPT-5 mini", brand: "openai" },
    { id: "o3", label: "o3", brand: "openai" },
  ],
  // OpenRouter is the universal gateway — one key reaches every lab. Free models first, then frontier.
  openrouter: [
    { id: "openai/gpt-oss-20b:free", label: "GPT-OSS 20B", free: true, brand: "openai" },
    { id: "qwen/qwen3-next-80b-a3b-instruct:free", label: "Qwen3 80B", free: true, brand: "qwen" },
    { id: "x-ai/grok-4.5", label: "Grok 4.5", brand: "xai" },
    { id: "x-ai/grok-4.20", label: "Grok 4.20 · 2M ctx", brand: "xai" },
    { id: "anthropic/claude-opus-4.8", label: "Claude Opus 4.8", brand: "anthropic" },
    { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5", brand: "anthropic" },
    { id: "openai/gpt-5.6-luna-pro", label: "GPT-5.6 Pro", brand: "openai" },
    { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", brand: "google" },
    { id: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro", brand: "deepseek" },
    { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick", brand: "meta" },
    { id: "qwen/qwen3.7-max", label: "Qwen 3.7 Max", brand: "qwen" },
    { id: "mistralai/mistral-medium-3-5", label: "Mistral Medium 3.5", brand: "mistral" },
  ],
};

/** Default model per provider. OpenRouter defaults to a FREE model so anyone can use it at no cost. */
export const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5",
  openrouter: "openai/gpt-oss-20b:free",
};

/** The binding the agent should use right now. A user key wins; otherwise Urizen Free Mode. */
export function getActiveBinding(): KeyBinding | null {
  const v = readVault();
  // a key only counts if it's actually non-blank — a whitespace/stale key must NOT be treated as real,
  // or we'd call the provider with an empty `Bearer` and get "Missing Authentication header". Fall to free.
  const has = (x: Provider) => ((v.keys[x] ?? "").trim().length > 0);
  const p = v.active && has(v.active) ? v.active : (Object.keys(v.keys) as Provider[]).find(has);
  if (p) return { provider: p, key: (v.keys[p] as string).trim(), model: v.model };
  // no user key → free mode (our server key + a free model)
  return { provider: "openrouter", key: "", model: FREE_MODEL, free: true };
}

/** True when running on Urizen Free Mode (no user key bound). */
export function isFreeMode(): boolean {
  return listProviderKeys().length === 0;
}

// ── model call + screen analysis (browser → provider, grounded in real indicators) ───

async function callModel(binding: KeyBinding, system: string, user: string): Promise<string> {
  const model = binding.model || DEFAULT_MODEL[binding.provider];
  if (binding.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": binding.key.trim(),
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1600,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `anthropic ${res.status}`);
    return data.content?.map((b: { text?: string }) => b.text || "").join("") ?? "";
  }
  // openrouter
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${binding.key.trim()}`,
      "http-referer": "https://urizenfund.com",
      "x-title": "URIZEN Quant Studio",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1600,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `openrouter ${res.status}`);
  return data.choices?.[0]?.message?.content ?? "";
}

/** Rank a filtered instrument set with a one-line read each — grounded in the real indicators. */
export async function analyzeScreen(
  binding: KeyBinding,
  indicators: Indicators[],
): Promise<{ symbol: string; score: number; note: string }[]> {
  const rows = indicators
    .map(
      (i) =>
        `${i.symbol}: 3m ${(i.return3m * 100).toFixed(1)}%, RSI ${i.rsi14.toFixed(0)}, annVol ${(i.volAnnual * 100).toFixed(0)}%, ` +
        `Sharpe ${i.sharpe.toFixed(2)}, maxDD ${(i.maxDrawdown * 100).toFixed(0)}%, trend ${i.trend}, regime ${i.regime}`,
    )
    .join("\n");
  const system =
    "You are URIZEN's screener. Rank tokenized equities for a momentum-aware quant using ONLY the real stats given. " +
    "Do not invent numbers. Output ONLY minified JSON: {\"ranked\":[{\"symbol\":string,\"score\":number 0-100,\"note\":string (<=10 words)}]}.";
  const raw = await callModel(binding, system, `INSTRUMENTS:\n${rows}\n\nRank all, best first.`);
  const parsed = extractJson(raw) as { ranked?: { symbol: string; score: number; note: string }[] };
  return parsed.ranked ?? [];
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("model returned no JSON");
  return JSON.parse(body.slice(start, end + 1));
}
