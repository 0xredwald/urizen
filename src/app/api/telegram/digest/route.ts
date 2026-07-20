import { tgSend, tgSendPhoto, broadcastChat, cronAuthed, mdToHtml } from "@/lib/telegram";
import { apiBase } from "@/lib/api-base";

const SITE = "https://urizenfund.com";

// Cron: post a short market + fund digest to the Telegram channel, written by our model over real
// data (fund book/stats + market pulse). One LLM call for reliability. Configure TELEGRAM_CHANNEL_ID.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Post the brief once a day at the US market close (~4 PM ET). The cron fires 20:10 + 21:10 UTC; the
// gate below lets exactly the 16:xx ET one through (EDT or EST). ?force=1 bypasses for a manual test.
const TEST_EVERY_RUN = false;

const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = [process.env.URIZEN_BOT_MODEL || "openai/gpt-oss-20b:free", "qwen/qwen3-next-80b-a3b-instruct:free"];

const j = async (u: string) => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch { return null; } };

async function write(system: string, user: string): Promise<string> {
  const key = process.env.TELEGRAM_OPENROUTER_KEY || process.env.URIZEN_FREE_OPENROUTER_KEY;
  if (!key) return "";
  for (const model of MODELS) {
    try {
      const r = await fetch(OPENROUTER, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "http-referer": "https://urizenfund.com", "x-title": "Urizen Digest" },
        body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 2000, temperature: 0.5 }),
      });
      if (r.ok) { const d = await r.json(); const t = (d?.choices?.[0]?.message?.content || "").trim(); if (t) return t; }
    } catch { /* next */ }
  }
  return "";
}

// Current wall-clock in New York (handles EDT/EST automatically).
function nyTime(): { hour: number; minute: number; weekday: string } {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(new Date());
  const get = (t: string) => p.find((x) => x.type === t)?.value || "";
  return { hour: Number(get("hour")), minute: Number(get("minute")), weekday: get("weekday") };
}

export async function GET(req: Request) {
  if (!cronAuthed(req)) return new Response("forbidden", { status: 401 });
  const chat = broadcastChat();
  if (!chat || !process.env.TELEGRAM_BOT_TOKEN) return Response.json({ ok: true, skipped: "not configured" });

  // Fire the market-open briefing only at ~9:30 ET. The cron runs at both 13:30 and 14:30 UTC so one of
  // them lands on 9:30 ET whether it's EDT or EST; the other is skipped here. ?force=1 bypasses (manual test).
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && !TEST_EVERY_RUN) {
    const t = nyTime();
    // fire in the 4 PM ET hour, after the close (the cron's two UTC times map one to 16:xx ET and one
    // to 15:xx/17:xx, so exactly one lands here whether EDT or EST) — hour-wide to tolerate a late run.
    const atClose = t.hour === 16;
    const weekday = !["Sat", "Sun"].includes(t.weekday);
    if (!atClose || !weekday) return Response.json({ ok: true, skipped: `not market close (ET ${t.weekday} ${t.hour}:${String(t.minute).padStart(2, "0")})` });
  }

  const B = apiBase();
  const [mkt, movers, macro, predFed, predRec] = await Promise.all([
    j(`${B}/api/quant/market`), j(`${B}/api/quant/movers`), j(`${B}/api/quant/macro`),
    j(`${B}/api/quant/predictions?q=${encodeURIComponent("Fed decision")}`),
    j(`${B}/api/quant/predictions?q=${encodeURIComponent("recession 2026")}`),
  ]);

  // ── real data only — never invent a number, ticker, headline or event ──
  // Indices don't trade pre/post-market; stocks do. When they're from different sessions the movers
  // header is labeled (e.g. "TOP MOVERS · PREMARKET") so nothing is misread as same-session.
  const moversSession: string = movers?.session || "";
  const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  const idxLine = (label: string) => {
    const it = (mkt?.items || []).find((m: { label: string }) => m.label === label);
    return it ? pct(it.changePct) : "n/a";
  };
  const gainers = (movers?.gainers || []).filter((m: { changePct: number }) => m.changePct > 0).slice(0, 2);
  const losers = (movers?.losers || []).filter((m: { changePct: number }) => m.changePct < 0).slice(0, 2);
  const moverStr = (arr: { symbol: string; changePct: number }[]) => arr.map((m) => `${m.symbol} ${pct(m.changePct)}`).join(", ") || "n/a";

  // real headlines for the biggest gainer + loser (to ground the "reasons")
  const newsSyms = [gainers[0]?.symbol, losers[0]?.symbol].filter(Boolean) as string[];
  const newsRes = await Promise.all(newsSyms.map((s) => j(`${B}/api/quant/news?symbol=${encodeURIComponent(s)}`)));
  const headlines = newsSyms.flatMap((s, i) => ((newsRes[i]?.items || []) as { title: string }[]).slice(0, 2).map((n) => `${s}: ${n.title}`));

  // calendar (this + next week), split by the event's ET date. If nothing lands exactly today (common
  // late in the week), fall back to the week's most recent releases so the section is never empty.
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const cal = (macro?.calendar || []) as { date: string; title: string; forecast?: string | null; previous?: string | null; actual?: string | null; impact?: string }[];
  const day = (e: { date: string }) => (e.date || "").slice(0, 10);
  const evLine = (e: { date: string; title: string; forecast?: string | null; actual?: string | null }) =>
    `${e.title}${e.actual ? ` (actual ${e.actual}${e.forecast ? `, est ${e.forecast}` : ""})` : e.forecast ? ` (est ${e.forecast})` : ""}`;
  const todayEv = cal.filter((e) => day(e) === todayKey);
  const recentEv = cal.filter((e) => day(e) < todayKey).slice(-4);
  const todayData = (todayEv.length ? todayEv : recentEv).map(evLine);
  const todayIsToday = todayEv.length > 0;
  const upcomingData = cal.filter((e) => day(e) > todayKey).slice(0, 5).map((e) => `${day(e)} — ${e.title}${e.forecast ? ` (est ${e.forecast})` : ""}`);
  const dateStr = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }).format(new Date());

  // real prediction-market odds (Polymarket) for the ODDS + outlook sections
  const odds = [...((predFed?.markets || []) as { question: string; outcome: string | null; probability: number | null }[]), ...((predRec?.markets || []) as { question: string; outcome: string | null; probability: number | null }[])]
    .filter((m) => m.probability != null && m.outcome)
    .slice(0, 4)
    .map((m) => `${m.question} → ${m.outcome} ${Math.round((m.probability as number) * 100)}%`);
  const rateStr = (macro?.rates || []).map((r: { label: string; value: string }) => `${r.label} ${r.value}`).join(", ");

  const data =
    `DATE: ${dateStr} (US market close)\n` +
    `INDICES (session % change): S&P 500 ${idxLine("S&P 500")}, Nasdaq ${idxLine("Nasdaq")}, Dow ${idxLine("Dow")}, Russell 2000 ${idxLine("Russell 2000")}, VIX ${idxLine("VIX")}, US 10Y ${idxLine("US 10Y")}.\n` +
    `RATES/MACRO LEVELS: ${rateStr || "n/a"}.\n` +
    `MOVERS SESSION: ${moversSession || "session close (same as indices)"}\n` +
    `TOP GAINERS (tokenized-stock universe, ${moversSession || "at the close"}): ${moverStr(gainers)}.\n` +
    `TOP LOSERS: ${moverStr(losers)}.\n` +
    `REAL HEADLINES (use ONLY these for reasons + headlines, trim them):\n${headlines.map((h) => `- ${h}`).join("\n") || "- (none)"}\n` +
    `PREDICTION MARKETS (Polymarket, real odds — use verbatim):\n${odds.map((o) => `- ${o}`).join("\n") || "- (none)"}\n` +
    `ECONOMIC RELEASES ${todayIsToday ? "TODAY" : "THIS WEEK (most recent, with results)"}:\n${todayData.map((c) => `- ${c}`).join("\n") || "- (none)"}\n` +
    `UPCOMING ECONOMIC EVENTS (next days):\n${upcomingData.map((c) => `- ${c}`).join("\n") || "- (none in feed)"}`;

  const body = await write(
    [
      "You are URIZEN — Blake's Ancient of Days, the intelligence that measures the markets. Write a DAILY MARKET BRIEF for a Telegram channel. Complete but CONCISE — aim for 1000-1500 characters. Tight, scannable, never overwhelming.",
      "ABSOLUTE RULE: use ONLY the data provided. NEVER invent a number, ticker, headline, event or odds. Every figure is verbatim from the data.",
      "VOICE: cold, oracular, faintly mythic (the ledger, the compass, order vs chaos) — but every claim earned with a real number. A verdict, never a hedge. No disclaimers. Punchy sentences, no filler.",
      "FORMATTING: rich, varied Telegram markdown — **bold** section headers + every number, _italic_ for prose, `code` for tickers/index names, '> ' blockquotes for the call, '• ' bullets, ▲/▼ for movers. Visually structured. No outer title (a banner image sits above).",
      "Sections in this order:",
      "**MARKET** — `S&P` [%] · `Nasdaq` [%] · `Dow` [%] · `Russell` [%], then _one sentence_ on the session.",
      "**TOP MOVERS** — CRITICAL: if MOVERS SESSION is PREMARKET / AFTER HOURS / INTRADAY, title this header EXACTLY `TOP MOVERS · <SESSION>` (those moves are from that session, NOT the same session as the index figures — never present them as one). If it's the session close, just `TOP MOVERS`. Then ▲/▼ **ticker** [%] — short reason (from a provided headline; else none).",
      "**HEADLINES** — up to 3 '• ' bullets from the provided headlines.",
      "**THESIS** — 2 tight sentences: what's driving the tape (rotation, rates/VIX, the movers). No rambling.",
      "**THE ODDS** — the provided Polymarket lines as '• ' bullets (question → outcome %). Optionally ONE short clause on what they imply.",
      "**CALENDAR** — up to 3 '• ' bullets of releases (label today/this week per the data).",
      "**NEXT** — the upcoming events, or one short honest line if none.",
      "> **URIZEN'S CALL** — 1-2 sentences: the forward view + the level/condition that confirms or breaks it. Grounded, oracular, decisive.",
    ].join("\n"),
    data,
  );
  if (!body) return Response.json({ ok: false, error: "digest generation unavailable" }, { status: 502 });

  // the banner, then the full thesis as its own message (a long thesis exceeds the 1024 caption limit,
  // so it can't live in the caption — the two post together and read as one report).
  await tgSendPhoto(chat, `${SITE}/img/market-report.jpg`, `◈ <b>URIZEN DAILY MARKET BRIEF</b> · ${dateStr}`);
  const text = `${mdToHtml(body)}\n\n<i>Urizen Alpha — research, analyze, and trade equities onchain.</i>\nurizenfund.com`.slice(0, 4090);
  const ok = await tgSend(chat, text, { parse_mode: "HTML" });
  return Response.json({ ok, posted: ok });
}
