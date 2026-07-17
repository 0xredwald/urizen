"use client";

import { useEffect, useState } from "react";

// ── Data panels for the Horizon terminal ─────────────────────────────────────
// Self-contained "panel body" components — the parent supplies the numbered Pane
// chrome, these just fill it (h-full) and scroll their own body. Each fetches one
// keyless /api/quant/* route, keyed on the active symbol, and renders in the
// terminal's identity: signal-green on near-black, mono/tabular data, muted labels.

// ── shared bits ──────────────────────────────────────────────────────────────

const UP = "text-signal";
const DOWN = "text-[#ff5a5a]";
const LABEL = "text-muted-foreground";

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full place-items-center px-4 text-center font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground/50">
      {children}
    </div>
  );
}

const Loading = () => <Center>loading…</Center>;

// One fetch, keyed on `key`, with loading + error collapse to null.
function usePanel<T>(url: string | null, key: string): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!url) return;
    let on = true;
    setLoading(true);
    setData(null);
    fetch(url)
      .then((r) => r.json())
      .then((d: unknown) => {
        if (on) setData(d as T);
      })
      .catch(() => {
        if (on) setData(null);
      })
      .finally(() => {
        if (on) setLoading(false);
      });
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, loading };
}

// compact USD (e.g. $394.3B / $12.4M)
function usd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const neg = n < 0;
  const a = Math.abs(n);
  const s =
    a >= 1e12 ? `${(a / 1e12).toFixed(2)}T` :
    a >= 1e9 ? `${(a / 1e9).toFixed(2)}B` :
    a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` :
    a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` :
    a.toFixed(2);
  return `${neg ? "-" : ""}$${s}`;
}

function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

// a labelled row: muted label left, mono value right
function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 px-3 py-1.5 text-[0.78rem]">
      <span className={`${LABEL}`}>{label}</span>
      <span className={`font-mono tabular-nums ${tone ?? "text-foreground/90"}`}>{value}</span>
    </div>
  );
}

// ── News ─────────────────────────────────────────────────────────────────────

type NewsItem = { title: string; url: string; publishedAt: string; source: string };
type NewsResp = { symbol?: string; items?: NewsItem[]; error?: string };

function timeAgo(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export function NewsPanel({ symbol }: { symbol: string }) {
  const { data, loading } = usePanel<NewsResp>(
    `/api/quant/news?symbol=${encodeURIComponent(symbol)}`,
    symbol,
  );
  if (loading) return <Loading />;
  const items = data?.items ?? [];
  if (items.length === 0) return <Center>no headlines</Center>;
  return (
    <div className="h-full overflow-auto">
      {items.map((it, i) => (
        <a
          key={`${it.url}-${i}`}
          href={it.url}
          target="_blank"
          rel="noreferrer"
          className="block border-b border-border/40 px-3 py-1.5 transition-colors hover:bg-white/[0.03]"
        >
          <div className="text-[0.78rem] leading-snug text-foreground/90">{it.title}</div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-wide text-muted-foreground/70">
            <span>{it.source}</span>
            {it.publishedAt && <span className="text-muted-foreground/40">· {timeAgo(it.publishedAt)}</span>}
            <span className="ml-auto text-signal/60">↗</span>
          </div>
        </a>
      ))}
    </div>
  );
}

// ── Ratings ────────────────────────────────────────────────────────────────

type Trend = { period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number };
type RatingsResp = {
  symbol?: string;
  available?: boolean;
  note?: string;
  consensus?: string;
  score?: number;
  analysts?: number;
  trend?: Trend[];
  error?: string;
};

const RATING_ROWS: { key: keyof Omit<Trend, "period">; label: string; tone: string }[] = [
  { key: "strongBuy", label: "Strong buy", tone: "bg-signal" },
  { key: "buy", label: "Buy", tone: "bg-signal/60" },
  { key: "hold", label: "Hold", tone: "bg-muted-foreground/50" },
  { key: "sell", label: "Sell", tone: "bg-[#ff5a5a]/60" },
  { key: "strongSell", label: "Strong sell", tone: "bg-[#ff5a5a]" },
];

export function RatingsPanel({ symbol }: { symbol: string }) {
  const { data, loading } = usePanel<RatingsResp>(
    `/api/quant/ratings?symbol=${encodeURIComponent(symbol)}`,
    symbol,
  );
  if (loading) return <Loading />;
  if (!data || data.error) return <Center>ratings unavailable</Center>;
  if (data.available === false) return <Center>{data.note ?? "no analyst coverage"}</Center>;

  const latest = data.trend?.[0];
  const total = data.analysts ?? 0;
  const bull = data.score != null && data.score >= 0;

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-2.5">
        <div>
          <div className={`font-display text-lg leading-none ${bull ? UP : DOWN}`}>{data.consensus ?? "—"}</div>
          <div className="mt-1 font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground">
            {total} analyst{total === 1 ? "" : "s"}
          </div>
        </div>
        <span className="font-mono text-[0.72rem] tabular-nums text-muted-foreground">
          score {data.score != null ? data.score.toFixed(2) : "—"}
        </span>
      </div>
      <div className="px-3 py-2">
        {RATING_ROWS.map((r) => {
          const count = latest ? latest[r.key] : 0;
          const width = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={r.key} className="flex items-center gap-2 py-1.5 text-[0.74rem]">
              <span className={`w-20 shrink-0 ${LABEL}`}>{r.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-sm bg-white/[0.05]">
                <span className={`block h-full rounded-sm ${r.tone}`} style={{ width: `${width}%` }} />
              </span>
              <span className="w-5 shrink-0 text-right font-mono tabular-nums text-foreground/80">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Fundamentals ─────────────────────────────────────────────────────────────

type Fundamentals = {
  fiscalYear: number | null;
  revenue: number | null;
  netIncome: number | null;
  netMargin: number | null;
  eps: number | null;
  assets: number | null;
  equity: number | null;
};
type FundResp = {
  symbol?: string;
  name?: string;
  available?: boolean;
  note?: string;
  latest?: Fundamentals;
  error?: string;
};

export function FundamentalsPanel({ symbol }: { symbol: string }) {
  const { data, loading } = usePanel<FundResp>(
    `/api/quant/fundamentals?symbol=${encodeURIComponent(symbol)}`,
    symbol,
  );
  if (loading) return <Loading />;
  if (!data || data.error) return <Center>fundamentals unavailable</Center>;
  if (data.available === false || !data.latest) return <Center>{data.note ?? "no SEC filer"}</Center>;

  const f = data.latest;
  const profitable = f.netIncome != null && f.netIncome >= 0;
  const marginPct = f.netMargin != null ? f.netMargin * 100 : null;

  return (
    <div className="h-full overflow-auto">
      {(data.name || f.fiscalYear) && (
        <div className="border-b border-border px-3 py-2">
          <div className="truncate text-[0.8rem] text-foreground/90">{data.name ?? symbol}</div>
          <div className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground">
            FY {f.fiscalYear ?? "—"} · 10-K
          </div>
        </div>
      )}
      <Row label="Revenue" value={usd(f.revenue)} />
      <Row label="Net income" value={usd(f.netIncome)} tone={profitable ? UP : DOWN} />
      <Row label="Net margin" value={pct(marginPct)} tone={marginPct != null ? (marginPct >= 0 ? UP : DOWN) : undefined} />
      <Row label="Diluted EPS" value={f.eps != null ? `$${f.eps.toFixed(2)}` : "—"} />
      <Row label="Total assets" value={usd(f.assets)} />
      <Row label="Equity" value={usd(f.equity)} />
    </div>
  );
}

// ── Macro ─────────────────────────────────────────────────────────────────────

type Rate = { label: string; value: string; detail?: string };
type MacroEvent = { date: string; title: string; impact: string; forecast: string | null; previous: string | null; actual: string | null };
type MacroResp = { rates?: Rate[]; calendar?: MacroEvent[]; source?: string };

function evDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
}

export function MacroPanel() {
  const { data, loading } = usePanel<MacroResp>(`/api/quant/macro`, "macro");
  if (loading) return <Loading />;
  const rates = data?.rates ?? [];
  const calendar = data?.calendar ?? [];
  if (rates.length === 0 && calendar.length === 0) return <Center>macro unavailable</Center>;

  return (
    <div className="h-full overflow-auto">
      {rates.length > 0 && (
        <div className="grid grid-cols-2 gap-px border-b border-border bg-border/40">
          {rates.map((r) => (
            <div key={r.label} className="bg-[#0b0b0d] px-3 py-2">
              <div className="font-mono text-[0.58rem] uppercase tracking-widest text-muted-foreground">{r.label}</div>
              <div className="mt-0.5 font-mono text-[0.95rem] tabular-nums text-signal">{r.value}</div>
              {r.detail && <div className="font-mono text-[0.56rem] text-muted-foreground/60">{r.detail}</div>}
            </div>
          ))}
        </div>
      )}
      {calendar.length > 0 && (
        <div>
          <div className="px-3 py-1.5 font-mono text-[0.58rem] uppercase tracking-widest text-muted-foreground/60">
            Economic calendar
          </div>
          {calendar.map((e, i) => (
            <div key={`${e.date}-${e.title}-${i}`} className="border-b border-border/40 px-3 py-1.5">
              <div className="flex items-center gap-2 text-[0.76rem]">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${e.impact === "High" ? "bg-[#ff5a5a]" : "bg-signal/60"}`} />
                <span className="truncate text-foreground/90">{e.title}</span>
                <span className="ml-auto shrink-0 font-mono text-[0.62rem] tabular-nums text-muted-foreground">{evDate(e.date)}</span>
              </div>
              {(e.forecast || e.previous || e.actual) && (
                <div className="mt-0.5 flex gap-3 pl-3.5 font-mono text-[0.6rem] tabular-nums text-muted-foreground/70">
                  {e.actual && <span className="text-signal">act {e.actual}</span>}
                  {e.forecast && <span>fc {e.forecast}</span>}
                  {e.previous && <span className="text-muted-foreground/50">prev {e.previous}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Predictions (Polymarket) ─────────────────────────────────────────────────

type Market = { question: string; probability: number | null; outcome: string; volumeUsd: number | null; url: string };
type PredResp = { query?: string; markets?: Market[]; source?: string; error?: string };

export function PredictionsPanel({ symbol }: { symbol: string }) {
  const { data, loading } = usePanel<PredResp>(
    `/api/quant/predictions?q=${encodeURIComponent(symbol + " stock")}`,
    symbol,
  );
  if (loading) return <Loading />;
  const markets = data?.markets ?? [];
  if (markets.length === 0) return <Center>no prediction markets</Center>;

  return (
    <div className="h-full overflow-auto">
      {markets.map((m, i) => {
        const prob = m.probability != null ? Math.round(m.probability * 100) : null;
        const hot = prob != null && prob >= 50;
        return (
          <a
            key={`${m.url}-${i}`}
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="block border-b border-border/40 px-3 py-1.5 transition-colors hover:bg-white/[0.03]"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[0.76rem] leading-snug text-foreground/90">{m.question}</div>
                <div className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-wide text-muted-foreground/70">
                  {m.outcome}
                  {m.volumeUsd != null && <span className="text-muted-foreground/40"> · {usd(m.volumeUsd)} vol</span>}
                </div>
              </div>
              <span className={`shrink-0 font-mono text-[0.95rem] tabular-nums ${hot ? UP : LABEL}`}>
                {prob != null ? `${prob}%` : "—"}
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}

// ── On-chain (DexScreener) ───────────────────────────────────────────────────

type OnchainResp = {
  address?: string;
  symbol?: string | null;
  priceUsd?: number | null;
  liquidityUsd?: number | null;
  volume24h?: number | null;
  priceChange24h?: number | null;
  pairUrl?: string | null;
  note?: string;
  error?: string;
};

function price(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 })}`;
}

export function OnchainPanel({ symbol }: { symbol: string }) {
  const { data, loading } = usePanel<OnchainResp>(
    `/api/quant/onchain?symbol=${encodeURIComponent(symbol)}`,
    symbol,
  );
  if (loading) return <Loading />;
  if (!data || data.error) return <Center>on-chain unavailable</Center>;

  const noPool = data.priceUsd == null && data.liquidityUsd == null && data.volume24h == null;
  if (noPool) return <Center>{data.note ?? "no indexed pool yet"}</Center>;

  const ch = data.priceChange24h;
  const chTone = ch == null ? undefined : ch >= 0 ? UP : DOWN;

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-2.5">
        <span className="font-display text-xl tabular-nums text-foreground">{price(data.priceUsd)}</span>
        <span className={`font-mono text-[0.8rem] tabular-nums ${chTone ?? LABEL}`}>
          {ch == null ? "—" : `${ch >= 0 ? "▲" : "▼"} ${pct(Math.abs(ch), 2)}`}
        </span>
      </div>
      <Row label="Liquidity" value={usd(data.liquidityUsd)} />
      <Row label="24h volume" value={usd(data.volume24h)} />
      <Row label="24h change" value={pct(ch, 2)} tone={chTone} />
      <Row label="Token" value={data.symbol ?? "—"} />
      {data.pairUrl && (
        <a
          href={data.pairUrl}
          target="_blank"
          rel="noreferrer"
          className="block px-3 py-2 font-mono text-[0.66rem] uppercase tracking-widest text-signal/70 transition-colors hover:text-signal"
        >
          DexScreener ↗
        </a>
      )}
    </div>
  );
}
