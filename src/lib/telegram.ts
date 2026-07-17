// Shared Telegram Bot API helpers for server-side posting (the webhook + the broadcast crons).
// Requires TELEGRAM_BOT_TOKEN. Broadcasts target TELEGRAM_CHANNEL_ID (a channel/group the bot admins).

const tgApi = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export async function tgSend(chatId: string | number, text: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return false;
  try {
    const r = await fetch(tgApi("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, disable_web_page_preview: true, ...extra, text }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Send and return the message_id (so we can edit it while streaming).
export async function tgSendReturnId(chatId: string | number, text: string): Promise<number | null> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return null;
  try {
    const r = await fetch(tgApi("sendMessage"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }) });
    const d = await r.json();
    return d?.result?.message_id ?? null;
  } catch { return null; }
}

// Edit a message's text (used to stream the answer in place). Silently ignores "not modified".
export async function tgEdit(chatId: string | number, messageId: number, text: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return false;
  try {
    const r = await fetch(tgApi("editMessageText"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: messageId, disable_web_page_preview: true, ...extra, text }) });
    return r.ok;
  } catch { return false; }
}

export async function tgSendPhoto(chatId: string | number, photoUrl: string, caption?: string): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return false;
  try {
    const r = await fetch(tgApi("sendPhoto"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: "HTML" }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Light markdown → Telegram HTML. Telegram supports b, i, u, s, code, pre, a, and blockquote
// (incl. <blockquote expandable>). We escape first, then map: **bold**, _italic_, `code`,
// "> " quote lines (grouped into one blockquote), ">! " expandable quote, • / - bullets, [text](url),
// and #headings → bold. Falls back cleanly — if Telegram rejects the markup the caller re-sends plain.
export function mdToHtml(s: string): string {
  let t = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  t = t.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
  t = t.replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,;:!?)])/g, "$1<i>$2</i>"); // _italic_ not inside words
  t = t.replace(/^\s{0,3}#{1,6}\s*(.+?)\s*$/gm, "<b>$1</b>");             // headings → bold
  t = t.replace(/^\s*[-*]\s+/gm, "• ");                                    // bullets
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');      // links
  // group consecutive "&gt; " (and "&gt;! " expandable) lines into blockquotes
  const lines = t.split("\n");
  const out: string[] = [];
  let q: string[] = [];
  let exp = false;
  const flush = () => { if (q.length) { out.push(`<blockquote${exp ? " expandable" : ""}>${q.join("\n")}</blockquote>`); q = []; exp = false; } };
  for (const ln of lines) {
    const m = ln.match(/^\s*&gt;(!)?\s?(.*)$/);
    if (m) { if (m[1]) exp = true; q.push(m[2]); }
    else { flush(); out.push(ln); }
  }
  flush();
  return out.join("\n");
}

// The broadcast target (a channel or group id/@username the bot posts to). Null if not configured.
export const broadcastChat = (): string | null => process.env.TELEGRAM_CHANNEL_ID || null;

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; verify it so the endpoints aren't public.
export function cronAuthed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unset → allow (dev); set it in prod to lock the crons down
  const auth = req.headers.get("authorization") || "";
  const url = new URL(req.url);
  return auth === `Bearer ${secret}` || url.searchParams.get("key") === secret;
}
