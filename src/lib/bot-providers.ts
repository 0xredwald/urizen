// The AI providers a Telegram DM user can bring their own key for. Every one exposes an
// OpenAI-compatible /chat/completions endpoint with `Authorization: Bearer <key>`, so a single code
// path drives them all. (Anthropic's native API isn't OpenAI-shaped; Claude models are reachable via
// OpenRouter instead.) Direct-message chat runs on the *user's* key + model — never ours.

export type BotModel = { id: string; label: string };
export type Provider = {
  id: string;
  label: string;
  emoji: string;
  base: string;        // OpenAI-compatible base URL (no trailing slash)
  keyHint: string;     // example key shape, shown when asking
  keyUrl: string;      // where to mint a key
  keyPrefix?: string;  // cheap sanity check on a pasted key
  models: BotModel[];  // pick-a-model options
  free?: boolean;      // has a usable free tier
  images?: "gemini" | "openrouter"; // can generate images on the user's key, and how
};

export const PROVIDERS: Provider[] = [
  {
    id: "openrouter", label: "OpenRouter", emoji: "🔀", base: "https://openrouter.ai/api/v1",
    keyHint: "sk-or-v1-…", keyUrl: "https://openrouter.ai/keys", keyPrefix: "sk-or-", free: true, images: "openrouter",
    models: [
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B · cheap + strong" },
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
      { id: "x-ai/grok-4", label: "Grok 4" },
      { id: "deepseek/deepseek-chat", label: "DeepSeek V3" },
      { id: "openai/gpt-oss-20b:free", label: "GPT-OSS 20B · free" },
    ],
  },
  {
    id: "openai", label: "OpenAI", emoji: "🟢", base: "https://api.openai.com/v1",
    keyHint: "sk-…", keyUrl: "https://platform.openai.com/api-keys", keyPrefix: "sk-",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini · fast + cheap" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4.1", label: "GPT-4.1" },
    ],
  },
  {
    id: "google", label: "Google Gemini", emoji: "🔷", base: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyHint: "AIza…", keyUrl: "https://aistudio.google.com/apikey", keyPrefix: "AIza", free: true, images: "gemini",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash · fast" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ],
  },
  {
    id: "xai", label: "xAI (Grok)", emoji: "✖️", base: "https://api.x.ai/v1",
    keyHint: "xai-…", keyUrl: "https://console.x.ai", keyPrefix: "xai-",
    models: [
      { id: "grok-4", label: "Grok 4" },
      { id: "grok-3-mini", label: "Grok 3 mini · cheap" },
    ],
  },
  {
    id: "groq", label: "Groq", emoji: "⚡", base: "https://api.groq.com/openai/v1",
    keyHint: "gsk_…", keyUrl: "https://console.groq.com/keys", keyPrefix: "gsk_", free: true,
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B · very fast" },
      { id: "moonshotai/kimi-k2-instruct", label: "Kimi K2" },
    ],
  },
  {
    id: "deepseek", label: "DeepSeek", emoji: "🐋", base: "https://api.deepseek.com/v1",
    keyHint: "sk-…", keyUrl: "https://platform.deepseek.com/api_keys", keyPrefix: "sk-",
    models: [
      { id: "deepseek-chat", label: "DeepSeek V3 · cheap" },
      { id: "deepseek-reasoner", label: "DeepSeek R1 · reasoning" },
    ],
  },
];

export const providerById = (id: string): Provider | undefined => PROVIDERS.find((p) => p.id === id);

// A user's resolved DM config: which provider, their key, and the chosen model.
export type ChatLLM = { providerId: string; key: string; model: string };

export function llmFor(cfg: ChatLLM): { base: string; key: string; models: string[] } | null {
  const p = providerById(cfg.providerId);
  if (!p) return null;
  return { base: p.base, key: cfg.key, models: [cfg.model] };
}
