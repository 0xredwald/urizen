import { cronAuthed, broadcastChat } from "@/lib/telegram";

// Telegram wiring diagnostics. The READ-ONLY checks (getMe / webhook / channel / bot membership) run
// without auth so we can see the config; actually POSTING a test line stays behind the cron secret.
//   diagnose:  curl "https://urizenfund.com/api/telegram/test"
//   send test: curl "https://urizenfund.com/api/telegram/test?key=YOUR_CRON_SECRET"
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tg = (token: string, method: string, qs = "") =>
  fetch(`https://api.telegram.org/bot${token}/${method}${qs}`).then((r) => r.json()).catch(() => ({}));

async function handle(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = broadcastChat();
  if (!token) return Response.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not set in Vercel" });

  const me = await tg(token, "getMe");
  const webhook = await tg(token, "getWebhookInfo");
  const botId = me?.result?.id;

  // check the OpenRouter keys the bot would spend (validity only — never the key itself)
  const keyHealth = async (k?: string): Promise<string> => {
    if (!k) return "unset";
    try {
      const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { authorization: `Bearer ${k}` } });
      if (r.ok) { const d = await r.json().catch(() => ({})); const rem = d?.data?.limit_remaining; return `valid${rem != null ? ` (remaining $${rem})` : ""}`; }
      return `INVALID (${r.status})`;
    } catch { return "error reaching OpenRouter"; }
  };
  const modelKeys = {
    groupKey_TELEGRAM_OPENROUTER_KEY: await keyHealth(process.env.TELEGRAM_OPENROUTER_KEY),
    fallback_URIZEN_FREE_OPENROUTER_KEY: await keyHealth(process.env.URIZEN_FREE_OPENROUTER_KEY),
  };
  // actually run the group's model with the house key — proves the group chat path end to end
  const houseKey = process.env.TELEGRAM_OPENROUTER_KEY || process.env.URIZEN_FREE_OPENROUTER_KEY;
  const model = process.env.URIZEN_BOT_MODEL || "openai/gpt-oss-120b";
  let groupModelTest = "no house key";
  if (houseKey) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${houseKey}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "hi" }], max_tokens: 5 }),
      });
      const d = await r.json().catch(() => ({}));
      groupModelTest = r.ok ? `ok (${model})` : `FAIL ${r.status}: ${(d?.error?.message || "").slice(0, 120)} [${model}]`;
    } catch (e) { groupModelTest = `error: ${String(e).slice(0, 80)}`; }
  }

  let channelInfo: unknown = "TELEGRAM_CHANNEL_ID not set";
  let botInChannel: unknown = "n/a";
  if (chat) {
    channelInfo = await tg(token, "getChat", `?chat_id=${encodeURIComponent(chat)}`);
    if (botId) botInChannel = await tg(token, "getChatMember", `?chat_id=${encodeURIComponent(chat)}&user_id=${botId}`);
  }

  // read-only summary anyone can pull
  const diag = {
    bot: me?.result?.username ? `@${me.result.username}` : me,
    webhookSet: !!webhook?.result?.url,
    webhookUrl: webhook?.result?.url || null,
    webhookLastError: webhook?.result?.last_error_message || null,
    modelKeys,
    groupModelTest,
    channelIdConfigured: chat || null,
    channel: (channelInfo as { result?: { title?: string } })?.result?.title ?? channelInfo,
    botStatusInChannel: (botInChannel as { result?: { status?: string; can_post_messages?: boolean } })?.result
      ? { status: (botInChannel as { result: { status?: string } }).result.status, can_post_messages: (botInChannel as { result: { can_post_messages?: boolean } }).result.can_post_messages }
      : botInChannel,
  };

  // posting requires the cron secret
  if (!cronAuthed(req)) return Response.json({ diagnostics: diag, note: "Read-only. Add ?key=<CRON_SECRET> to also post a test line." });
  if (!chat) return Response.json({ diagnostics: diag, sent: false, error: "TELEGRAM_CHANNEL_ID not set" });

  const send = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, parse_mode: "HTML", disable_web_page_preview: true, text: "✅ <b>Urizen Alpha</b> — channel wired. Broadcasts and trade alerts will post here." }),
  }).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));

  return Response.json({ diagnostics: diag, sent: send?.ok === true, sendResult: send });
}

export const GET = handle;
export const POST = handle;
