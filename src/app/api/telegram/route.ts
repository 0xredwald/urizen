import { runAlphaBotStream, HOUSE_MODELS, type LlmConfig } from "@/lib/alpha-server";
import { tgSendReturnId, tgEdit, mdToHtml } from "@/lib/telegram";
import type { Artifact } from "@/lib/alpha-tools";
import { aiImage, aiImageGemini, aiImageOpenRouter, cardUrl } from "@/lib/image-gen";
import { configToCode } from "@/lib/agent-graph";
import { PROVIDERS, providerById, detectBotProvider, looksLikeApiKey, llmFor, type ChatLLM } from "@/lib/bot-providers";
import { getState, setLlm, setSkills, clearAi, tgLinkSig } from "@/lib/bot-store";

const SITE = "https://urizenfund.com";
const APP = "https://urizenfund.com/alpha";

// Urizen Alpha as a Telegram bot. Telegram POSTs updates here (webhook). We run the same server-side
// agent (full research toolbelt) and reply. Trading is non-custodial: the bot proposes, then links the
// user to the app to sign. In DMs the bot runs on the *user's* own AI key (a guided /start connects it);
// in our own group/channel it runs on the house key. Set TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const api = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
async function tg(method: string, body: Record<string, unknown>) {
  try { await fetch(api(method), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); } catch { /* best effort */ }
}
const send = (chatId: number, text: string, extra: Record<string, unknown> = {}) =>
  tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true, ...extra, text });
// Edit a text message in place, or send a fresh one when there's nothing editable (e.g. the tap came
// from a photo/media message, which has no editable text).
const editOrSend = (chatId: number, mid: number | undefined, text: string, reply_markup?: unknown) =>
  mid
    ? tg("editMessageText", { chat_id: chatId, message_id: mid, parse_mode: "HTML", disable_web_page_preview: true, text, reply_markup })
    : send(chatId, text, reply_markup ? { reply_markup } : {});

// Upload raw image bytes (AI-generated) to Telegram via multipart.
async function sendPhotoBytes(chatId: number, base64: string, mime: string, caption?: string) {
  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    if (caption) form.append("caption", caption);
    form.append("photo", new Blob([Buffer.from(base64, "base64")], { type: mime }), "urizen.png");
    await fetch(api("sendPhoto"), { method: "POST", body: form });
  } catch { /* best effort */ }
}

// Send a text file (e.g. a strategy module).
async function sendDocument(chatId: number, filename: string, content: string, caption?: string) {
  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    if (caption) form.append("caption", caption);
    form.append("document", new Blob([content], { type: "text/plain" }), filename);
    await fetch(api("sendDocument"), { method: "POST", body: form });
  } catch { /* best effort */ }
}

// Telegram caps messages at 4096 chars; keep well under and split if needed.
function chunk(s: string, n = 3500): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out.length ? out : [""];
}

// A branded Urizen chart image (our own /api/og/chart — neon area chart, mark, price header).
function chartImage(a: Extract<Artifact, { type: "chart" }>): string | null {
  if (!a.symbol) return null;
  return `${SITE}/api/og/chart?symbol=${encodeURIComponent(a.symbol)}&range=${encodeURIComponent(a.range || "1m")}`;
}

// ── per-chat state ────────────────────────────────────────────────────────────────────────────
// The DM connection (provider/key/model), tool toggles and linked wallet are PERSISTED via bot-store
// (Supabase) so they survive serverless cold starts. Only `pending` — the transient onboarding step —
// stays in memory (if it's lost, the stateless key handler recovers by detecting the provider).
const pending = new Map<number, { step: "key" | "model"; providerId: string; key?: string }>();
async function getCfg(chatId: number): Promise<ChatLLM | null> {
  const s = await getState(chatId);
  return s.provider && s.key && s.model ? { providerId: s.provider, key: s.key, model: s.model } : null;
}

// Skills the user can toggle on/off (the agent's tools).
const SKILL_TOGGLES: { id: string; label: string }[] = [
  { id: "show_chart", label: "Chart" }, { id: "market_stats", label: "Technicals" }, { id: "screen_market", label: "Screener" }, { id: "compare_stocks", label: "Compare" },
  { id: "fundamentals", label: "Fundamentals" }, { id: "filings", label: "Filings" }, { id: "analyst_ratings", label: "Ratings" }, { id: "stock_news", label: "News" },
  { id: "macro_calendar", label: "Macro" }, { id: "market_pulse", label: "Market" }, { id: "token_onchain", label: "On-chain" }, { id: "prediction_markets", label: "Predictions" },
  { id: "generate_image", label: "Images" }, { id: "build_strategy", label: "Strategy" }, { id: "propose_swap", label: "Swap" },
];
const ALL_TOOL_IDS = SKILL_TOGGLES.map((s) => s.id);
const enabledFor = async (chatId: number): Promise<string[]> => (await getState(chatId)).skills ?? ALL_TOOL_IDS;
function skillsKeyboard(enabled: string[]) {
  const en = new Set(enabled);
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < SKILL_TOGGLES.length; i += 2) rows.push(SKILL_TOGGLES.slice(i, i + 2).map((s) => ({ text: `${en.has(s.id) ? "✅" : "⬜"} ${s.label}`, callback_data: `sk:${s.id}` })));
  return { inline_keyboard: rows };
}

// Connect-wallet button. ALWAYS a plain link (opens the system browser), never a Telegram Mini App
// (web_app): wallets can't pop up inside Telegram's in-app webview (no injected provider, and
// WalletConnect deep-links don't return), so a web_app just strands the user on a page they can't
// connect from. In the external browser the wallet (extension or the wallet's own browser) works.
// Non-custodial: the user connects + signs in their own wallet on the page.
function walletKeyboard(chatId: number) {
  // signed tg param so the page can report the connected address back to THIS chat (and only this one)
  const url = `${APP}?connect=1&tg=${chatId}&sig=${tgLinkSig(chatId)}`;
  return { inline_keyboard: [[{ text: "🔗 Connect wallet in browser", url }]] };
}

// Resolve the LLM to spend: the house key in a group/channel, the user's own connection in a DM.
async function resolveLlm(chatId: number, chatType?: string): Promise<LlmConfig | null> {
  if (chatType && chatType !== "private") {
    const key = process.env.TELEGRAM_OPENROUTER_KEY || process.env.URIZEN_FREE_OPENROUTER_KEY;
    return key ? { base: "https://openrouter.ai/api/v1", key, models: HOUSE_MODELS } : null;
  }
  const cfg = await getCfg(chatId);
  return cfg ? llmFor(cfg) : null;
}

// Deliver an image: a real AI image on the user's own key (never ours in a DM), else the branded card.
async function deliverImage(chatId: number, prompt: string, caption: string | undefined, ctx: { chatType?: string; cfg?: ChatLLM }) {
  let img = null;
  const p = ctx.cfg ? providerById(ctx.cfg.providerId) : null;
  if (p?.images === "gemini" && ctx.cfg) img = await aiImageGemini(ctx.cfg.key, prompt);
  else if (p?.images === "openrouter" && ctx.cfg) img = await aiImageOpenRouter(ctx.cfg.key, prompt);
  else if (ctx.chatType && ctx.chatType !== "private") img = await aiImage(prompt); // our optional key — group/channel only
  if (img) { await sendPhotoBytes(chatId, img.base64, img.mime, caption); return; }
  await tg("sendPhoto", { chat_id: chatId, photo: cardUrl(SITE, { tag: "URIZEN", title: caption || prompt }) }); // free fallback
}

// ── onboarding wizard ─────────────────────────────────────────────────────────────────────────
const providerRows = () => {
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < PROVIDERS.length; i += 2) rows.push(PROVIDERS.slice(i, i + 2).map((p) => ({ text: p.label, callback_data: `ob:prov:${p.id}` })));
  return { inline_keyboard: rows };
};
async function sendProviderPicker(chatId: number, editId?: number) {
  const body =
    "<b>Connect your AI</b>\n\n" +
    "In direct messages I run on <i>your</i> key — your usage, your data, never shared. Pick the provider you have a key with:";
  if (editId) await tg("editMessageText", { chat_id: chatId, message_id: editId, parse_mode: "HTML", disable_web_page_preview: true, text: body, reply_markup: providerRows() });
  else await send(chatId, body, { reply_markup: providerRows() });
}
function modelKeyboard(providerId: string) {
  const p = providerById(providerId)!;
  return { inline_keyboard: [...p.models.map((m, i) => [{ text: m.label, callback_data: `ob:model:${providerId}:${i}` }]), [{ text: "← Change provider", callback_data: "ob:start" }]] };
}
async function sendModelPicker(chatId: number, providerId: string, editId?: number) {
  const p = providerById(providerId)!;
  const body = `<b>${p.label}</b>\n\nPick a model — you can change it anytime with /model:`;
  if (editId) await tg("editMessageText", { chat_id: chatId, message_id: editId, parse_mode: "HTML", disable_web_page_preview: true, text: body, reply_markup: modelKeyboard(providerId) });
  else await send(chatId, body, { reply_markup: modelKeyboard(providerId) });
}

// tappable starter prompts, shown once connected
const EXAMPLES: { code: string; label: string; q: string }[] = [
  { code: "ex_chart", label: "📈 How's NVDA?", q: "How does NVDA look right now?" },
  { code: "ex_fund", label: "🏦 NVDA fundamentals", q: "NVDA fundamentals and analyst consensus" },
  { code: "ex_macro", label: "🗓 Macro this week", q: "What's on the macro calendar this week?" },
  { code: "ex_odds", label: "🎲 Fed odds", q: "What are the Polymarket odds on the next Fed decision?" },
];
const starterKeyboard = { inline_keyboard: [[EXAMPLES[0], EXAMPLES[1]], [EXAMPLES[2], EXAMPLES[3]]].map((row) => row.map((e) => ({ text: e.label, callback_data: e.code }))) };

async function sendConnectedHome(chatId: number, cfg: ChatLLM, wallet?: string) {
  const p = providerById(cfg.providerId)!;
  const walletLine = wallet
    ? `\n🔗 Wallet connected · <code>${wallet.slice(0, 6)}…${wallet.slice(-4)}</code> — ready to trade.`
    : "\n🔗 No wallet yet — <code>/wallet</code> to connect one and trade.";
  await send(chatId,
    `◈ <b>Urizen Alpha</b> — connected on <b>${p.label}</b> · <code>${cfg.model}</code>.${walletLine}\n\n` +
    "Ask me anything about stocks — I pull real data (charts, SEC fundamentals, ratings, news, macro, Polymarket odds, on-chain) and give you a call.\n\n" +
    "Tap a starter, the <b>/</b> menu, or <code>/skills</code> to pick my tools. <code>/model</code> switches models.",
    { reply_markup: starterKeyboard });
}
const WELCOME_CAPTION =
  "◈ <b>Urizen Alpha</b>\nYour on-chain equity-research desk — real data, real calls, right in chat.\n\n" +
  "I chart stocks, read SEC filings, track macro + Polymarket odds, build exportable strategies, and set up non-custodial trades you sign yourself.\n\n" +
  "First, a 30-second setup — connect your AI:";
async function startFlow(chatId: number, chatType?: string) {
  void registerCommands();
  if (chatType && chatType !== "private") {
    await send(chatId, "◈ <b>Urizen Alpha</b> is live here. @mention me or reply to me with a question, or use the <b>/</b> commands. In groups I run on the house key — no setup needed.");
    return;
  }
  const st = await getState(chatId);
  const cfg = st.provider && st.key && st.model ? { providerId: st.provider, key: st.key, model: st.model } : null;
  if (cfg) { await sendConnectedHome(chatId, cfg, st.wallet); return; }
  // first-touch: the branded Urizen × Telegram banner, then the connect button
  await tg("sendPhoto", { chat_id: chatId, photo: `${SITE}/img/bot-welcome.jpg`, caption: WELCOME_CAPTION, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "⚡ Connect AI", callback_data: "ob:start" }]] } });
}

// ── slash commands that map to a research query ───────────────────────────────────────────────
const SLASH: { cmd: string; desc: string; prompt: (a: string) => string }[] = [
  { cmd: "chart", desc: "Price chart + technicals", prompt: (a) => `Show the ${a || "NVDA"} chart and read its technicals.` },
  { cmd: "stats", desc: "RSI, vol, Sharpe, trend", prompt: (a) => `Give me the full technical read on ${a || "NVDA"}.` },
  { cmd: "screen", desc: "Rank the universe", prompt: (a) => (a ? `Screen the tokenized-stock universe: ${a}.` : `Screen the tokenized-stock universe for the strongest setups.`) },
  { cmd: "compare", desc: "Two stocks side by side", prompt: (a) => `Compare ${a || "NVDA and AMD"} on their technicals.` },
  { cmd: "fundamentals", desc: "SEC fundamentals", prompt: (a) => `Pull ${a || "NVDA"}'s latest fundamentals from its SEC filings.` },
  { cmd: "filings", desc: "Filings + insiders", prompt: (a) => `Show ${a || "NVDA"}'s recent SEC filings and insider activity.` },
  { cmd: "ratings", desc: "Analyst consensus", prompt: (a) => `What's the analyst consensus on ${a || "NVDA"}?` },
  { cmd: "news", desc: "Latest headlines", prompt: (a) => `What's the latest news on ${a || "NVDA"}?` },
  { cmd: "macro", desc: "Fed/CPI + calendar", prompt: () => `Show the macro picture — rates, CPI, and this week's economic calendar.` },
  { cmd: "market", desc: "Indices, VIX, rates", prompt: () => `Give me the market pulse — indices, VIX and rates.` },
  { cmd: "onchain", desc: "On-chain price", prompt: (a) => `Show the on-chain price and liquidity for ${a || "URI"}.` },
  { cmd: "odds", desc: "Polymarket odds", prompt: (a) => `What are the Polymarket odds on ${a || "the next Fed decision"}?` },
  { cmd: "strategy", desc: "Build a strategy", prompt: (a) => `Build a strategy: ${a || "momentum on NVDA and AAPL"}.` },
];
const SLASH_MAP = new Map(SLASH.map((s) => [s.cmd, s]));

// register the "/" menu once per warm instance
let commandsRegistered = false;
async function registerCommands() {
  if (commandsRegistered) return;
  commandsRegistered = true;
  const commands = [
    { command: "start", description: "Connect your AI / home" },
    { command: "model", description: "Switch AI model" },
    { command: "forget", description: "Wipe your API key from memory" },
    { command: "skills", description: "Toggle which tools I use" },
    { command: "image", description: "Generate an image" },
    { command: "wallet", description: "Connect your wallet (non-custodial)" },
    { command: "swap", description: "Swap tokens — /swap 100 USDG NVDA" },
    { command: "app", description: "Open the app to trade" },
    ...SLASH.map((s) => ({ command: s.cmd, description: s.desc })),
  ];
  await tg("setMyCommands", { commands });
  // modern touch: a persistent button by the input that opens the app as a Telegram Mini App.
  // Requires the bot's domain to be set once in BotFather (/setdomain → urizenfund.com); until then
  // Telegram just keeps the default commands button, so this is safe to call unconditionally.
  await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Open Urizen", web_app: { url: APP } } });
}

// Answer a question: stream the reply live (edit one message), then send any charts/images/strategy/swap.
async function answer(chatId: number, question: string, llm: LlmConfig, imgCtx: { chatType?: string; cfg?: ChatLLM }) {
  await tg("sendChatAction", { chat_id: chatId, action: "typing" });
  try {
    const msgId = await tgSendReturnId(chatId, "…");
    let lastEdit = 0, shown = "";
    const flush = (t: string) => {
      const now = Date.now();
      if (msgId && t && t !== shown && t.length >= shown.length && now - lastEdit > 1300) { lastEdit = now; shown = t; void tgEdit(chatId, msgId, t.slice(0, 3900)); }
    };
    const { text: ans, artifacts } = await runAlphaBotStream(question, [], {
      onStatus: (s) => { if (!shown) flush(`🧠 ${s}`); },
      onText: (full) => flush(full),
    }, await enabledFor(chatId), llm);
    // final pass: render markdown as Telegram HTML; fall back to plain if Telegram rejects the markup
    const raw = (ans || "…").slice(0, 3900);
    const html = mdToHtml(raw);
    if (msgId) { const ok = await tgEdit(chatId, msgId, html, { parse_mode: "HTML" }); if (!ok && raw !== shown) await tgEdit(chatId, msgId, raw); }
    else { for (const part of chunk(ans || "…")) await send(chatId, mdToHtml(part)); }
    for (const a of artifacts) {
      if (a.type === "chart") { const img = chartImage(a); if (img) await tg("sendPhoto", { chat_id: chatId, photo: img }); }
      else if (a.type === "image") { await deliverImage(chatId, a.prompt, undefined, imgCtx); }
    }
    const strat = artifacts.find((a): a is Extract<Artifact, { type: "strategy" }> => a.type === "strategy");
    if (strat) {
      const code = configToCode(strat.name, strat.mandate, "balanced", strat.config);
      await sendDocument(chatId, `${strat.name.replace(/\s+/g, "-").toLowerCase()}.strategy.ts`, code, "Your strategy — bounded & auditable. Run it, edit it, or wire it up in the app.");
    }
    const swap = artifacts.find((a): a is Extract<Artifact, { type: "swap" }> => a.type === "swap");
    if (swap) {
      const p = swap.proposal;
      const link = `${APP}?sell=${encodeURIComponent(p.sellSym)}&buy=${encodeURIComponent(p.buySym)}&amount=${encodeURIComponent(p.sellAmount)}`;
      // plain link (external browser) — signing needs the wallet to pop up, which it can't inside a Mini App
      const btn = { text: "↗ Open & sign in your wallet", url: link };
      await send(chatId,
        `⚖️ <b>The trade is drawn.</b>\n<code>${p.sellAmount} ${p.sellSym}</code> → <code>${p.buySym}</code>\n\nYou sign it in your own wallet — I never hold your keys. Non-custodial, as it should be.`,
        { reply_markup: { inline_keyboard: [[btn]] } });
    }
  } catch {
    await send(chatId, "Something glitched on my end — try that again in a moment.");
  }
}

// Ask a DM user to connect if they aren't set up yet. Returns the resolved llm, or null (and prompts).
async function requireLlm(chatId: number, chatType?: string): Promise<LlmConfig | null> {
  const llm = await resolveLlm(chatId, chatType);
  if (llm) return llm;
  if (chatType && chatType !== "private") { await send(chatId, "The bot isn't configured for this group yet."); return null; }
  // concise reconnect nudge (not the full welcome banner) — you can just paste your key to connect
  await send(chatId,
    "Connect your AI to chat — paste your API key here (OpenRouter · OpenAI · Gemini · xAI · Groq) and I'll wire it up, or tap below to pick a provider.",
    { reply_markup: { inline_keyboard: [[{ text: "⚡ Connect AI", callback_data: "ob:start" }]] } });
  return null;
}

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) return new Response("forbidden", { status: 401 });
  if (!process.env.TELEGRAM_BOT_TOKEN) return new Response("not configured", { status: 200 });

  let update: {
    message?: { chat?: { id?: number; type?: string }; text?: string; entities?: { type: string }[]; reply_to_message?: { from?: { is_bot?: boolean } } };
    callback_query?: { id: string; data?: string; message?: { chat?: { id?: number; type?: string }; message_id?: number; photo?: unknown[] } };
  };
  try { update = await req.json(); } catch { return new Response("ok", { status: 200 }); }

  // ── button taps ──────────────────────────────────────────────────────────────────────────────
  if (update.callback_query) {
    const cq = update.callback_query;
    await tg("answerCallbackQuery", { callback_query_id: cq.id });
    const cid = cq.message?.chat?.id;
    const cType = cq.message?.chat?.type;
    // a photo/media message has no editable text — editMessageText fails on it, so post fresh instead.
    // (The welcome banner's "Connect AI" button lives on a photo; that's why it appeared dead.)
    const mid = Array.isArray(cq.message?.photo) ? undefined : cq.message?.message_id;
    const data = cq.data || "";
    if (!cid) return new Response("ok", { status: 200 });

    if (data === "ob:start") { await sendProviderPicker(cid, mid); return new Response("ok", { status: 200 }); }
    if (data.startsWith("ob:prov:")) {
      const pid = data.slice(8);
      const p = providerById(pid);
      if (p) {
        pending.set(cid, { step: "key", providerId: pid });
        await editOrSend(cid, mid,
          `<b>${p.label}</b>\n\nPaste your API key (looks like <code>${p.keyHint}</code>).\nGet one at ${p.keyUrl}\n\n🔒 Kept for this session only — never stored. Since this is our DM, only you can see it.`,
          { inline_keyboard: [[{ text: "← Back", callback_data: "ob:start" }]] });
      }
      return new Response("ok", { status: 200 });
    }
    if (data.startsWith("ob:model:")) {
      const [, , pid, idxStr] = data.split(":");
      const p = providerById(pid);
      const idx = Number(idxStr);
      const cur = pending.get(cid);
      const key = cur?.key || (await getCfg(cid))?.key;
      if (p && p.models[idx] && key) {
        await setLlm(cid, pid, key, p.models[idx].id);
        pending.delete(cid);
        // step 2 of onboarding: AI is connected — now prompt to connect a wallet (to trade).
        const kb = { inline_keyboard: [...walletKeyboard(cid).inline_keyboard, ...starterKeyboard.inline_keyboard] };
        await editOrSend(cid, mid,
          `🎯 <b>AI connected</b> — ${p.label} · <code>${p.models[idx].id}</code>.\n\nNow connect your wallet to <b>trade</b> — non-custodial, you sign every trade, I never hold your keys. You can research without it, too.`,
          kb);
      } else {
        await sendProviderPicker(cid, mid);
      }
      return new Response("ok", { status: 200 });
    }
    if (data.startsWith("sk:")) {
      const id = data.slice(3);
      const set = new Set((await getState(cid)).skills ?? ALL_TOOL_IDS);
      set.has(id) ? set.delete(id) : set.add(id);
      const next = [...set];
      await setSkills(cid, next);
      if (mid) await tg("editMessageReplyMarkup", { chat_id: cid, message_id: mid, reply_markup: skillsKeyboard(next) });
      return new Response("ok", { status: 200 });
    }
    const ex = EXAMPLES.find((e) => e.code === data);
    if (ex) { const llm = await requireLlm(cid, cType); if (llm) await answer(cid, ex.q, llm, { chatType: cType, cfg: (await getCfg(cid)) ?? undefined }); }
    return new Response("ok", { status: 200 });
  }

  // ── messages ─────────────────────────────────────────────────────────────────────────────────
  const msg = update.message;
  const chatId = msg?.chat?.id;
  const chatType = msg?.chat?.type;
  const text = (msg?.text || "").trim();
  if (!chatId || !text) return new Response("ok", { status: 200 });

  // Capture a pasted API key (DMs only). STATELESS: a key connects you whether or not the onboarding
  // step survived the serverless cold start — we honor the picked provider if `pending` is still here,
  // otherwise detect the provider from the key's shape. This kills the "key → /start again" bug.
  if ((!chatType || chatType === "private") && looksLikeApiKey(text)) {
    const pend = pending.get(chatId);
    const p = pend ? providerById(pend.providerId) : detectBotProvider(text);
    if (p) {
      if (pend && p.keyPrefix && !text.startsWith(p.keyPrefix)) {
        await send(chatId, `That doesn't look like a ${p.label} key (they start with <code>${p.keyPrefix}</code>). Paste it again, or /start to pick another provider.`);
        return new Response("ok", { status: 200 });
      }
      // connect immediately on a sensible default model so it's usable even if they skip the picker
      await setLlm(chatId, p.id, text, p.models[0].id);
      pending.delete(chatId);
      await send(chatId, `✅ <b>Connected</b> on ${p.label}. Pick a model (or keep the default and just ask):`);
      await sendModelPicker(chatId, p.id);
      return new Response("ok", { status: 200 });
    }
  }

  // hard commands
  if (text === "/start" || text === "/help") { await startFlow(chatId, chatType); return new Response("ok", { status: 200 }); }
  if (text === "/connect" || text === "/key") {
    if (chatType && chatType !== "private") await send(chatId, "In groups I run on the house key — no /connect needed. Set your own provider in a direct message with me.");
    else await sendProviderPicker(chatId);
    return new Response("ok", { status: 200 });
  }
  if (text === "/model") {
    const cfg = await getCfg(chatId);
    if (chatType && chatType !== "private") await send(chatId, "The group runs on the house model. Switch your own model in a direct message.");
    else if (cfg) await sendModelPicker(chatId, cfg.providerId);
    else await startFlow(chatId, chatType);
    return new Response("ok", { status: 200 });
  }
  if (text === "/forget") {
    await clearAi(chatId); pending.delete(chatId);
    await send(chatId, "🧹 Done — your key is wiped from my memory. It was only ever held in memory for the session (never stored, never logged). Tip: you can also delete the message where you pasted it from this chat. Send /start to reconnect.");
    return new Response("ok", { status: 200 });
  }
  if (text === "/skills") { await send(chatId, "Toggle which tools I can use — tap to switch on/off:", { reply_markup: skillsKeyboard(await enabledFor(chatId)) }); return new Response("ok", { status: 200 }); }
  if (text === "/app" || text === "/trade" || text === "/wallet" || text === "/connectwallet") {
    const { wallet } = await getState(chatId);
    if (wallet) {
      await send(chatId,
        `🔗 <b>Wallet connected</b> · <code>${wallet.slice(0, 6)}…${wallet.slice(-4)}</code>.\n\nYou're set to trade — non-custodial, you sign every trade yourself. Tap below any time to reopen the app.`,
        { reply_markup: walletKeyboard(chatId) });
    } else {
      await send(chatId,
        "🔗 <b>Connect your wallet</b>\n\nUrizen is <b>non-custodial</b> — I never hold your keys or your funds. You connect your own wallet and sign every trade yourself.\n\nTap below to open Urizen in your browser and connect — it links back here automatically, so I'll know you're set.",
        { reply_markup: walletKeyboard(chatId) });
    }
    return new Response("ok", { status: 200 });
  }
  if (text.startsWith("/image")) {
    const prompt = text.replace(/^\/image(@\w+)?\s*/, "").trim();
    if (!prompt) { await send(chatId, "Give me something to draw — e.g. <code>/image a bull charging down Wall Street</code>"); return new Response("ok", { status: 200 }); }
    await tg("sendChatAction", { chat_id: chatId, action: "upload_photo" });
    await deliverImage(chatId, prompt, prompt, { chatType, cfg: (await getCfg(chatId)) ?? undefined });
    return new Response("ok", { status: 200 });
  }
  // manual swap through Rialto — /swap 100 USDG NVDA (amount, from, to). Non-custodial: opens a
  // pre-filled sign card in your browser. Buy a stock with USDG, or sell it back for USDG.
  if (text.startsWith("/swap") || text.startsWith("/buy") || text.startsWith("/sell")) {
    const buy = text.startsWith("/buy"), sell = text.startsWith("/sell");
    const m = text.match(/^\/(?:swap|buy|sell)(?:@\w+)?\s+([\d.]+)\s+([A-Za-z]+)(?:\s+(?:->|to|for)?\s*([A-Za-z]+))?/i);
    if (!m) {
      await send(chatId, "Set up a swap:\n<code>/swap 100 USDG NVDA</code> — amount, from, to\n<code>/buy 100 NVDA</code> · <code>/sell 5 NVDA</code> (vs USDG)");
      return new Response("ok", { status: 200 });
    }
    const amount = m[1];
    let from = m[2].toUpperCase(), to = (m[3] || "").toUpperCase();
    if (buy && !m[3]) { to = from; from = "USDG"; }        // /buy 100 NVDA  → USDG→NVDA
    else if (sell && !m[3]) { to = "USDG"; }               // /sell 5 NVDA   → NVDA→USDG
    if (!to) to = "USDG";
    const link = `${APP}?sell=${encodeURIComponent(from)}&buy=${encodeURIComponent(to)}&amount=${encodeURIComponent(amount)}`;
    await send(chatId,
      `⚖️ <b>Swap</b> · <code>${amount} ${from}</code> → <code>${to}</code>\n\nNon-custodial — you sign it in your own wallet. Opens pre-filled, ready to sign.`,
      { reply_markup: { inline_keyboard: [[{ text: "↗ Open & sign in your wallet", url: link }]] } });
    return new Response("ok", { status: 200 });
  }

  // a "/command arg" that maps to a research query (tolerate the @botname groups append)
  const m = text.match(/^\/(\w+)(?:@\w+)?(?:\s+([\s\S]*))?$/);
  if (m && SLASH_MAP.has(m[1])) {
    const llm = await requireLlm(chatId, chatType);
    if (llm) await answer(chatId, SLASH_MAP.get(m[1])!.prompt((m[2] || "").trim()), llm, { chatType, cfg: (await getCfg(chatId)) ?? undefined });
    return new Response("ok", { status: 200 });
  }

  const question = text.startsWith("/ask ") ? text.slice(5) : text.replace(/^\/\w+\s*/, "");
  if (!question) return new Response("ok", { status: 200 });

  // In a group we run on the house key, so only answer plain chatter when explicitly addressed
  // (an @mention or a reply to the bot) — this holds even if an admin disables Telegram privacy mode.
  if (chatType && chatType !== "private") {
    const mentioned = (msg?.entities || []).some((e) => e.type === "mention");
    const repliedToBot = msg?.reply_to_message?.from?.is_bot === true;
    if (!mentioned && !repliedToBot) return new Response("ok", { status: 200 });
  }

  const llm = await requireLlm(chatId, chatType);
  if (llm) await answer(chatId, question, llm, { chatType, cfg: (await getCfg(chatId)) ?? undefined });
  return new Response("ok", { status: 200 });
}
