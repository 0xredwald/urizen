"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
import { StockLogo } from "@/components/brand/stock-logo";
import { EngravedChart } from "@/components/quant/engraved-chart";
import { sma, type Indicators } from "@/lib/quant";
import { configToCode, configToSkill } from "@/lib/agent-graph";
import { getQuote, resolveToken, fromRaw, type Quote } from "@/lib/rialto";
import { executeSwap } from "@/lib/swap-exec";
import type { Artifact } from "@/lib/alpha-tools";

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const money = (x: number) => (x >= 1000 ? x.toFixed(0) : x.toFixed(2));
const tone = (r: Indicators["regime"]) => (r === "risk-on" ? "text-signal" : r === "risk-off" ? "text-[#ff5c5c]" : "text-muted-foreground");

function Chips({ ind }: { ind: Indicators }) {
  const items: [string, string][] = [
    ["RSI", ind.rsi14.toFixed(0)], ["Vol", `${(ind.volAnnual * 100).toFixed(0)}%`], ["Sharpe", ind.sharpe.toFixed(2)],
    ["Max DD", `−${(ind.maxDrawdown * 100).toFixed(0)}%`], ["3m", pct(ind.return3m)], ["Trend", ind.trend],
  ];
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-6">
      {items.map(([k, v]) => (
        <div key={k} className="bg-card px-2.5 py-1.5">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</div>
          <div className="font-mono text-[13px] tabular-nums text-foreground">{v}</div>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ a }: { a: Extract<Artifact, { type: "chart" }> }) {
  // memoize so streaming re-renders above the chart don't re-init the canvas (stops the glitch/stack)
  const smas = useMemo(() => {
    const c = a.data.candles.map((k) => k.c);
    return { s20: sma(c, 20), s50: sma(c, 50) };
  }, [a.data]);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <StockLogo symbol={a.symbol} size={30} />
        <div className="mr-auto flex items-baseline gap-2">
          <span className="font-semibold tracking-tight">{a.symbol}</span>
          <span className="font-mono text-sm tabular-nums">${money(a.ind.price)}</span>
          <span className={`font-mono text-xs ${a.ind.change1d >= 0 ? "text-signal" : "text-[#ff5c5c]"}`}>{pct(a.ind.change1d)}</span>
        </div>
        <span className={`font-mono text-[10px] uppercase tracking-widest ${tone(a.ind.regime)}`}>{a.ind.regime}</span>
      </div>
      <div className="px-2 pt-1">
        <EngravedChart candles={a.data.candles} sma20={smas.s20} sma50={smas.s50} up={a.ind.change1d >= 0} height={220} />
      </div>
      <div className="p-3 pt-1"><Chips ind={a.ind} /></div>
    </div>
  );
}

function StatsCard({ a }: { a: Extract<Artifact, { type: "stats" }> }) {
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2.5">
        <StockLogo symbol={a.symbol} size={28} />
        <div className="mr-auto"><div className="text-sm font-semibold">{a.symbol}</div><div className="text-[11px] text-muted-foreground">{a.name}</div></div>
        <span className="font-mono text-sm tabular-nums">${money(a.ind.price)}</span>
        <span className={`font-mono text-xs ${a.ind.change1d >= 0 ? "text-signal" : "text-[#ff5c5c]"}`}>{pct(a.ind.change1d)}</span>
      </div>
      <Chips ind={a.ind} />
    </div>
  );
}

function ScreenCard({ a }: { a: Extract<Artifact, { type: "screen" }> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Screen · {a.note}</div>
      <div className="divide-y divide-border/60">
        {a.rows.map((r) => (
          <div key={r.symbol} className="flex items-center gap-3 px-4 py-2">
            <StockLogo symbol={r.symbol} size={22} />
            <div className="mr-auto"><div className="font-mono text-[12px]">{r.symbol}</div><div className="text-[10px] text-muted-foreground">{r.name}</div></div>
            <span className={`w-16 text-right font-mono text-[12px] tabular-nums ${r.ind.return3m >= 0 ? "text-signal" : "text-[#ff5c5c]"}`}>{pct(r.ind.return3m)}</span>
            <span className="w-14 text-right font-mono text-[11px] tabular-nums text-muted-foreground">RSI {r.ind.rsi14.toFixed(0)}</span>
            <span className="w-16 text-right font-mono text-[11px] tabular-nums text-muted-foreground">S {r.ind.sharpe.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareCard({ a }: { a: Extract<Artifact, { type: "compare" }> }) {
  const rows: [string, (i: Indicators) => string, (i: Indicators) => string][] = [
    ["Price", (i) => `$${money(i.price)}`, () => "text-foreground"],
    ["3m", (i) => pct(i.return3m), (i) => (i.return3m >= 0 ? "text-signal" : "text-[#ff5c5c]")],
    ["6m", (i) => pct(i.return6m), (i) => (i.return6m >= 0 ? "text-signal" : "text-[#ff5c5c]")],
    ["RSI", (i) => i.rsi14.toFixed(0), () => "text-foreground"],
    ["Vol", (i) => `${(i.volAnnual * 100).toFixed(0)}%`, () => "text-foreground"],
    ["Sharpe", (i) => i.sharpe.toFixed(2), () => "text-foreground"],
    ["Regime", (i) => i.regime, (i) => tone(i.regime)],
  ];
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[420px] border-collapse text-[12px]">
        <thead><tr className="border-b border-border">
          <th className="px-3 py-2"></th>
          {a.items.map((it) => (
            <th key={it.symbol} className="px-3 py-2 text-right"><div className="flex items-center justify-end gap-1.5"><StockLogo symbol={it.symbol} size={18} /><span className="font-mono">{it.symbol}</span></div></th>
          ))}
        </tr></thead>
        <tbody>
          {rows.map(([label, fmt, col]) => (
            <tr key={label} className="border-b border-border/50">
              <td className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</td>
              {a.items.map((it) => <td key={it.symbol} className={`px-3 py-1.5 text-right font-mono tabular-nums ${col(it.ind)}`}>{fmt(it.ind)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SwapCard({ a, taker }: { a: Extract<Artifact, { type: "swap" }>; taker: string | null }) {
  const p = a.proposal;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [execStatus, setExecStatus] = useState<string | null>(null);

  const quoteIt = async () => {
    if (!taker) { setErr("Connect your wallet to trade."); return; }
    setLoading(true); setErr(null); setNotConfigured(false);
    try { setQuote(await getQuote({ sellSym: p.sellSym, buySym: p.buySym, sellAmount: p.sellAmount, taker, slippageBps: 200 })); }
    catch (e) { const er = e as Error & { notConfigured?: boolean }; setNotConfigured(!!er.notConfigured); setErr(er.message); }
    finally { setLoading(false); }
  };
  const doSwap = async () => {
    if (!quote || !taker) return;
    setExecuting(true); setErr(null);
    try { setHash(await executeSwap(quote, taker, p.sellSym, setExecStatus)); }
    catch (e) { setErr((e as Error).message.split("\n")[0]); } finally { setExecuting(false); setExecStatus(null); }
  };
  const out = quote ? fromRaw(quote.buy_amount, resolveToken(p.buySym).decimals) : 0;

  return (
    <div className="grid gap-2 rounded-lg border border-signal/30 bg-signal/[0.04] p-3">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-signal">◈ Proposed swap · you sign</div>
      <div className="flex items-center gap-2 text-sm">
        <StockLogo symbol={p.sellSym === "USDG" ? "USDG" : p.sellSym} size={22} />
        <span className="font-mono tabular-nums">{p.sellAmount} {p.sellSym}</span>
        <span className="text-muted-foreground">→</span>
        <StockLogo symbol={p.buySym} size={22} />
        <span className="font-mono">{p.buySym}</span>
        {quote && <span className="font-mono text-muted-foreground">≈ {out.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>}
      </div>
      {p.rationale && <p className="text-[12px] leading-snug text-foreground/80">{p.rationale}</p>}
      {err && <div className="font-mono text-[11px] text-[#ff5c5c]">{notConfigured ? "Live trading isn't switched on yet (RIALTO_API_KEY unset)." : err}</div>}
      {hash ? (
        <a href={`https://robinhoodchain.blockscout.com/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="rounded-md border border-signal/60 bg-signal/10 px-3 py-2 text-center font-mono text-[11px] uppercase tracking-widest text-signal hover:bg-signal/20">✓ sent · view ↗</a>
      ) : quote ? (
        <button onClick={doSwap} disabled={executing} className="rounded-md border border-signal/60 bg-signal/10 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-signal hover:bg-signal/20 disabled:opacity-50">{executing ? (execStatus ?? "confirm in wallet…") : `swap ${p.sellSym} → ${p.buySym}`}</button>
      ) : (
        <button onClick={quoteIt} disabled={loading} className="rounded-md border border-signal/60 bg-signal/10 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-signal hover:bg-signal/20 disabled:opacity-50">{loading ? "routing…" : "get quote"}</button>
      )}
    </div>
  );
}

const opWord = (op: string) => op.replace("crosses_above", "crosses above").replace("crosses_below", "crosses below").replace(">=", "≥").replace("<=", "≤");

function StrategyCard({ a }: { a: Extract<Artifact, { type: "strategy" }> }) {
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const c = a.config;
  const code = configToCode(a.name, a.mandate, "balanced", c);
  const slug = a.name.replace(/\s+/g, "-").toLowerCase();
  const download = (name: string, text: string, type = "text/markdown") => {
    const url = URL.createObjectURL(new Blob([text], { type })); const el = document.createElement("a"); el.href = url; el.download = name; el.click(); URL.revokeObjectURL(url);
  };
  const when = c.trigger.kind === "interval" || c.trigger.kind === "session"
    ? `every ${c.trigger.every ?? "6h"}`
    : `when ${c.trigger.symbol ?? ""} ${c.trigger.indicator ?? ""} ${opWord(c.trigger.op ?? "")} ${c.trigger.value ?? ""}`.trim();
  const Row = ({ k, children }: { k: string; children: ReactNode }) => (
    <div className="flex gap-3 px-4 py-2">
      <span className="w-14 shrink-0 pt-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</span>
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
  return (
    <div className="overflow-hidden rounded-lg border border-signal/25 bg-[#08080a]">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-signal">◆</span>
          <span className="text-sm font-semibold tracking-tight">{a.name}</span>
          <span className="rounded border border-signal/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-signal">{a.mandate}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCode((v) => !v)} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-signal">{showCode ? "hide code" : "code"}</button>
          <button onClick={() => download(`${slug}.strategy.ts`, code, "text/typescript")} className="font-mono text-[10px] uppercase tracking-widest text-signal hover:underline">⇩ .ts</button>
          <button onClick={() => download(`${slug}.SKILL.md`, configToSkill(a.name, a.mandate, "balanced", c))} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-signal">⇩ skill</button>
        </div>
      </div>

      {/* human-readable spec */}
      <div className="divide-y divide-border/40">
        <Row k="Universe"><div className="flex flex-wrap gap-1.5">{c.instruments.map((s) => <span key={s} className="inline-flex items-center gap-1 rounded bg-white/[0.05] px-1.5 py-0.5"><StockLogo symbol={s} size={14} /><span className="font-mono text-[11px]">{s}</span></span>)}</div></Row>
        <Row k="When"><span className="font-mono text-[12px] text-signal">{when}</span></Row>
        <Row k="If all">
          {c.conditions.length === 0 ? <span className="text-muted-foreground">always (no gate)</span> : (
            <ul className="grid gap-1">{c.conditions.map((cond, i) => (
              <li key={i} className="font-mono text-[12px]"><span className="text-foreground/60">{cond.symbol ? cond.symbol + " " : ""}</span>{cond.indicator} <span className="text-signal">{opWord(cond.op)}</span> {String(cond.value)}</li>
            ))}</ul>
          )}
        </Row>
        <Row k="Then">
          <ul className="grid gap-1">{c.actions.map((act, i) => (
            <li key={i} className="text-[13px]"><span className={`font-semibold ${act.kind === "buy" || act.kind === "rotate" ? "text-signal" : act.kind === "hold" ? "text-muted-foreground" : "text-[#ff5c5c]"}`}>{act.kind}</span>{act.symbol ? ` ${act.symbol}` : ""}{act.sizePct != null ? ` — ${act.sizePct}% of sleeve` : ""}</li>
          ))}</ul>
        </Row>
        <Row k="Sleeve"><span className="font-mono text-[12px] tabular-nums">{c.sleevePct}% of book</span></Row>
        {c.guards.length > 0 && <Row k="Guards"><div className="flex flex-wrap gap-1.5">{c.guards.map((g) => <span key={g} className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{g}</span>)}</div></Row>}
      </div>

      {showCode && <pre className="max-h-[380px] overflow-auto border-t border-border p-4 font-mono text-[12px] leading-relaxed text-foreground/85"><code>{code}</code></pre>}
      <div className="border-t border-border px-4 py-1.5 text-center font-mono text-[9px] text-muted-foreground">Bounded &amp; auditable · proposes, never executes · you sign every trade</div>
    </div>
  );
}

const bn = (x: number | null) => (x == null ? "—" : Math.abs(x) >= 1e9 ? `$${(x / 1e9).toFixed(1)}B` : Math.abs(x) >= 1e6 ? `$${(x / 1e6).toFixed(1)}M` : `$${x.toLocaleString()}`);
const ago = (iso: string) => { const s = (Date.now() - new Date(iso).getTime()) / 1000; if (!isFinite(s) || s < 0) return ""; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`; };

function NewsCard({ a }: { a: Extract<Artifact, { type: "news" }> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">News · {a.symbol}</div>
      {a.items.length === 0 ? (
        <div className="px-4 py-3 text-[12px] text-muted-foreground">No headlines right now.</div>
      ) : (
        <div className="divide-y divide-border/60">
          {a.items.slice(0, 8).map((n, i) => (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02]">
              <span className="mt-0.5 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{ago(n.publishedAt)}</span>
              <span className="flex-1 text-[13px] leading-snug text-foreground/90">{n.title}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function MarketCard({ a }: { a: Extract<Artifact, { type: "market" }> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Market pulse</div>
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
        {a.items.map((m) => (
          <div key={m.symbol} className="bg-card px-3 py-2.5">
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{m.label}</div>
            <div className="mt-0.5 font-mono text-[14px] tabular-nums text-foreground">{m.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <div className={`font-mono text-[11px] tabular-nums ${m.changePct >= 0 ? "text-signal" : "text-[#ff5c5c]"}`}>{m.changePct >= 0 ? "+" : ""}{m.changePct.toFixed(2)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OnchainCard({ a }: { a: Extract<Artifact, { type: "onchain" }> }) {
  const d = a.data;
  const price = d.priceUsd == null ? "—" : d.priceUsd < 0.01 ? `$${d.priceUsd.toPrecision(3)}` : `$${d.priceUsd.toFixed(4)}`;
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2.5">
        <StockLogo symbol={d.symbol} size={26} />
        <div className="mr-auto"><div className="text-sm font-semibold">{d.symbol}</div><div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">On-chain · RH 4663</div></div>
        <span className="font-mono text-sm tabular-nums">{price}</span>
        {d.priceChange24h != null && <span className={`font-mono text-xs ${d.priceChange24h >= 0 ? "text-signal" : "text-[#ff5c5c]"}`}>{d.priceChange24h >= 0 ? "+" : ""}{d.priceChange24h.toFixed(1)}%</span>}
      </div>
      {d.priceUsd == null ? (
        <div className="text-[12px] text-muted-foreground">{d.note || "No indexed pool yet."}</div>
      ) : (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
          <div className="bg-card px-2.5 py-1.5"><div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Liquidity</div><div className="font-mono text-[13px] tabular-nums">{bn(d.liquidityUsd)}</div></div>
          <div className="bg-card px-2.5 py-1.5"><div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">24h volume</div><div className="font-mono text-[13px] tabular-nums">{bn(d.volume24h)}</div></div>
        </div>
      )}
      {d.pairUrl && <a href={d.pairUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-signal">view pair ↗</a>}
    </div>
  );
}

function FundamentalsCard({ a }: { a: Extract<Artifact, { type: "fundamentals" }> }) {
  if (!a.available || !a.latest) {
    return <div className="rounded-lg border border-border bg-card p-3 text-[12px] text-muted-foreground"><span className="font-semibold text-foreground/80">{a.symbol}</span> — {a.note || "no SEC fundamentals available"}.</div>;
  }
  const f = a.latest;
  const items: [string, string][] = [
    ["Revenue", bn(f.revenue)], ["Net income", bn(f.netIncome)],
    ["Net margin", f.netMargin != null ? `${(f.netMargin * 100).toFixed(1)}%` : "—"], ["Diluted EPS", f.eps != null ? `$${f.eps.toFixed(2)}` : "—"],
    ["Assets", bn(f.assets)], ["Equity", bn(f.equity)],
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
        <StockLogo symbol={a.symbol} size={26} />
        <div className="mr-auto"><div className="text-sm font-semibold">{a.symbol}</div><div className="text-[10px] text-muted-foreground">{a.name}</div></div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SEC · FY{f.fiscalYear}</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
        {items.map(([k, v]) => (
          <div key={k} className="bg-card px-3 py-2"><div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</div><div className="font-mono text-[13px] tabular-nums text-foreground">{v}</div></div>
        ))}
      </div>
    </div>
  );
}

function FilingsCard({ a }: { a: Extract<Artifact, { type: "filings" }> }) {
  if (!a.available || a.filings.length === 0) {
    return <div className="rounded-lg border border-border bg-card p-3 text-[12px] text-muted-foreground"><span className="font-semibold text-foreground/80">{a.symbol}</span> — {a.note || "no SEC filings available"}.</div>;
  }
  const badge = (form: string) => form === "4" ? "text-[#ffb020]" : form.startsWith("10-K") ? "text-signal" : "text-muted-foreground";
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SEC filings · {a.symbol}</span>
        {a.insiderRecentCount > 0 && <span className="font-mono text-[10px] text-[#ffb020]">{a.insiderRecentCount} insider Form 4</span>}
      </div>
      <div className="divide-y divide-border/60">
        {a.filings.slice(0, 8).map((f, i) => (
          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-white/[0.02]">
            <span className={`w-14 shrink-0 font-mono text-[11px] ${badge(f.form)}`}>{f.form}</span>
            <span className="mr-auto font-mono text-[11px] tabular-nums text-muted-foreground">{f.date}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function MacroCard({ a }: { a: Extract<Artifact, { type: "macro" }> }) {
  const fmtDate = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); };
  const impact = (i: string) => (i === "High" ? "text-[#ff5c5c]" : "text-[#ffb020]");
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Macro desk</div>
      {a.rates.length > 0 && (
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {a.rates.map((r) => (
            <div key={r.label} className="bg-card px-3 py-2.5">
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{r.label}</div>
              <div className="mt-0.5 font-mono text-[15px] tabular-nums text-foreground">{r.value}</div>
              {r.detail && <div className="font-mono text-[9px] text-muted-foreground">{r.detail}</div>}
            </div>
          ))}
        </div>
      )}
      {a.calendar.length > 0 && (
        <div>
          <div className="border-y border-border px-4 py-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">This week · US high-impact</div>
          <div className="divide-y divide-border/60">
            {a.calendar.slice(0, 8).map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2">
                <span className="w-20 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{fmtDate(e.date)}</span>
                <span className="mr-auto text-[12px] text-foreground/90">{e.title}</span>
                {e.actual ? (
                  <span className="font-mono text-[11px] tabular-nums text-signal">{e.actual}</span>
                ) : e.forecast ? (
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">est {e.forecast}</span>
                ) : null}
                <span className={`w-2 shrink-0 text-center font-mono text-[13px] ${impact(e.impact)}`}>•</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {a.rates.length === 0 && a.calendar.length === 0 && <div className="px-4 py-3 text-[12px] text-muted-foreground">Macro data unavailable right now.</div>}
    </div>
  );
}

function RatingsCard({ a }: { a: Extract<Artifact, { type: "ratings" }> }) {
  if (!a.available || !a.trend?.length) {
    return <div className="rounded-lg border border-border bg-card p-3 text-[12px] text-muted-foreground"><span className="font-semibold text-foreground/80">{a.symbol}</span> — {a.note || "no analyst coverage"}.</div>;
  }
  const t = a.trend[0];
  const total = t.strongBuy + t.buy + t.hold + t.sell + t.strongSell || 1;
  const segs: [string, number, string][] = [
    ["Strong buy", t.strongBuy, "bg-signal"], ["Buy", t.buy, "bg-signal/60"], ["Hold", t.hold, "bg-muted-foreground/40"],
    ["Sell", t.sell, "bg-[#ff5c5c]/60"], ["Strong sell", t.strongSell, "bg-[#ff5c5c]"],
  ];
  const tone = a.consensus?.includes("Buy") ? "text-signal" : a.consensus?.includes("Sell") ? "text-[#ff5c5c]" : "text-foreground";
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
        <StockLogo symbol={a.symbol} size={26} />
        <div className="mr-auto"><div className="text-sm font-semibold">{a.symbol}</div><div className="text-[10px] text-muted-foreground">{a.name}</div></div>
        <div className="text-right"><div className={`text-sm font-semibold ${tone}`}>{a.consensus}</div><div className="font-mono text-[10px] text-muted-foreground">{a.analysts} analysts</div></div>
      </div>
      <div className="p-3">
        <div className="flex h-2 overflow-hidden rounded-full">
          {segs.map(([k, v, c]) => v > 0 ? <div key={k} className={c} style={{ width: `${(v / total) * 100}%` }} title={`${k}: ${v}`} /> : null)}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {segs.map(([k, v]) => <span key={k}>{k} <span className="tabular-nums text-foreground/80">{v}</span></span>)}
        </div>
      </div>
    </div>
  );
}

function PredictionsCard({ a }: { a: Extract<Artifact, { type: "predictions" }> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Prediction markets · {a.query}</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Polymarket</span>
      </div>
      {a.markets.length === 0 ? (
        <div className="px-4 py-3 text-[12px] text-muted-foreground">No markets found.</div>
      ) : (
        <div className="divide-y divide-border/60">
          {a.markets.slice(0, 6).map((m, i) => {
            const pct = m.probability != null ? Math.round(m.probability * 100) : null;
            return (
              <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="block px-4 py-2.5 transition-colors hover:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-[12px] leading-snug text-foreground/90">{m.question}</span>
                  {pct != null && <span className="shrink-0 font-mono text-[13px] tabular-nums text-signal">{pct}%</span>}
                </div>
                {pct != null && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-signal" style={{ width: `${pct}%` }} /></div>
                    <span className="font-mono text-[10px] text-muted-foreground">{m.outcome}</span>
                  </div>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const ArtifactView = memo(function ArtifactView({ artifact, taker }: { artifact: Artifact; taker: string | null }) {
  switch (artifact.type) {
    case "chart": return <ChartCard a={artifact} />;
    case "stats": return <StatsCard a={artifact} />;
    case "screen": return <ScreenCard a={artifact} />;
    case "compare": return <CompareCard a={artifact} />;
    case "swap": return <SwapCard a={artifact} taker={taker} />;
    case "strategy": return <StrategyCard a={artifact} />;
    case "news": return <NewsCard a={artifact} />;
    case "market": return <MarketCard a={artifact} />;
    case "onchain": return <OnchainCard a={artifact} />;
    case "fundamentals": return <FundamentalsCard a={artifact} />;
    case "filings": return <FilingsCard a={artifact} />;
    case "macro": return <MacroCard a={artifact} />;
    case "ratings": return <RatingsCard a={artifact} />;
    case "predictions": return <PredictionsCard a={artifact} />;
    case "image": return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={artifact.url} alt={artifact.prompt} className="w-full max-w-[520px] rounded-lg border border-border" />
    );
  }
});
