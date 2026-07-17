import { getFundTrades, FUND_WALLETS, tradeLabel } from "@/lib/fund-wallet";
import { tgSendPhoto, broadcastChat, cronAuthed } from "@/lib/telegram";
import { ROBINHOOD_CHAIN } from "@/lib/chain";
import { bySymbol } from "@/lib/stocks";
import { apiBase } from "@/lib/api-base";

const SITE = "https://urizenfund.com";

// a 0-100 normalized sparkline of the token's recent closes (stocks only; else empty)
async function sparkFor(symbol: string): Promise<string> {
  if (!bySymbol(symbol)) return "";
  try {
    const d = await fetch(`${apiBase()}/api/quant/ohlc?symbol=${encodeURIComponent(symbol)}&range=1m`).then((r) => r.json());
    const cs: number[] = (d?.candles || []).map((k: { c: number }) => k.c);
    if (cs.length < 3) return "";
    const lo = Math.min(...cs), hi = Math.max(...cs), sp = hi - lo || 1;
    return cs.slice(-30).map((c) => Math.round(((c - lo) / sp) * 100)).join(",");
  } catch {
    return "";
  }
}

// Cron: watch the fund wallet for new trades and auto-post buy/sell alerts to the Telegram channel.
// Dedup without a DB: a module-level set of posted hashes (survives warm invocations) + a time window
// so a cold start only ever re-checks the last few minutes. Configure TELEGRAM_CHANNEL_ID + CRON_SECRET.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const posted = new Set<string>();
const LOOKBACK_MIN = Number(process.env.FUND_WATCH_LOOKBACK_MIN || 8);
const MAX_PER_RUN = 5;

const fmt = (n: number, dp = 4) => n.toLocaleString(undefined, { maximumFractionDigits: dp });

// only use a token logo if the file actually exists (many memecoins/newer tickers have none) — a
// missing logo would otherwise render as an empty ring on the card.
async function logoUrl(symbol: string): Promise<string> {
  if (!bySymbol(symbol)) return "";
  const u = `${SITE}/logos/stocks/${symbol}.png`;
  try { return (await fetch(u, { method: "HEAD" })).ok ? u : ""; } catch { return ""; }
}

export async function GET(req: Request) {
  if (!cronAuthed(req)) return new Response("forbidden", { status: 401 });
  const chat = broadcastChat();
  if (!chat || !process.env.TELEGRAM_BOT_TOKEN) return Response.json({ ok: true, skipped: "not configured (TELEGRAM_CHANNEL_ID / TELEGRAM_BOT_TOKEN)" });

  const cutoff = Date.now() - LOOKBACK_MIN * 60_000;
  let trades;
  try {
    // both fund wallets; internal fund↔fund transfers are already tagged "move" and skipped below
    trades = (await Promise.all(FUND_WALLETS.map((w) => getFundTrades(w, 15).catch(() => [])))).flat();
  } catch (e) { return Response.json({ ok: false, error: (e as Error).message }, { status: 502 }); }

  // Alert only on the fund's real activity — LP moves, swaps, and buys/sells of a known stock, $URI, or
  // any token with real USD value. This drops junk-airdrop "receives" (unknown token, no price) that
  // would otherwise spam the channel.
  const isLp = (k: string) => k === "lp-add" || k === "lp-remove" || k === "lp";
  const relevant = (t: (typeof trades)[number]) =>
    isLp(t.kind) || t.kind === "swap" || !!bySymbol(t.symbol) || t.symbol === "URI" || (t.valueUsd != null && t.valueUsd >= 5);

  // one alert per transaction, newest-relevant first, only recent + unseen, capped. Dedup by tx hash
  // is now correct because getFundTrades returns exactly one classified event per tx.
  const fresh = trades
    .filter((t) => t.kind !== "move" && relevant(t) && new Date(t.timestamp).getTime() >= cutoff && !posted.has(t.hash))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, MAX_PER_RUN);

  let sent = 0;
  for (const t of fresh) {
    const { verb, tone } = tradeLabel(t);
    const emoji = tone === "up" ? "🟢" : tone === "down" ? "🔴" : "🔷";
    const usd = t.valueUsd != null ? fmt(t.valueUsd, 2) : "";
    const link = `${ROBINHOOD_CHAIN.blockscout}/tx/${t.hash}`;
    const spark = await sparkFor(t.symbol);
    const logo = await logoUrl(t.symbol);
    const isLp = t.kind === "lp-add" || t.kind === "lp-remove" || t.kind === "lp";
    // head reads correctly per kind: "Bought SPCX", "Swapped WETH → SPCX", "Added liquidity · SPCX + CASHCAT"
    const head = isLp ? `${verb}${t.symbol2 ? ` · ${t.symbol} + ${t.symbol2}` : ` · ${t.symbol}`}` : `${verb} ${t.symbol}`;
    const card = `${SITE}/api/og/alert?kind=${t.kind}&token=${encodeURIComponent(t.symbol)}${t.symbol2 ? `&token2=${encodeURIComponent(t.symbol2)}` : ""}&amount=${encodeURIComponent(fmt(t.amount))}` +
      `${usd ? `&usd=${encodeURIComponent(usd)}` : ""}${spark ? `&spark=${spark}` : ""}${logo ? `&logo=${encodeURIComponent(logo)}` : ""}`;
    const caption = `${emoji} <b>URIZEN ${head}</b>${usd ? ` · $${usd}` : ""}\n<a href="${link}">view tx ↗</a>`;
    const ok = await tgSendPhoto(chat, card, caption);
    if (ok) { posted.add(t.hash); sent++; }
  }

  // keep the dedup set from growing forever
  if (posted.size > 500) { const keep = [...posted].slice(-200); posted.clear(); keep.forEach((h) => posted.add(h)); }

  return Response.json({ ok: true, checked: trades.length, sent });
}
