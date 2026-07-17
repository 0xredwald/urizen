"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { KlineChart, type ChartHandle } from "@/components/terminal/kline-chart";
import { HorizonCursor, type CursorHandle } from "@/components/terminal/horizon-cursor";
import { AncientOfDays } from "@/components/quant/ancient-of-days";
import { UrizenMark } from "@/components/brand/marks";
import { STOCKS } from "@/lib/stocks";
import { runHorizon, type HAction, type HMsg } from "@/lib/horizon";
import { unlockVault } from "@/lib/agents";
import type { Candle } from "@/lib/quant";

// ── Horizon Terminal — P1 shell ──────────────────────────────────────────────
// Numbered-pane Bloomberg layout in our identity (signal green on near-black, a faint Blake
// "Ancient of Days" behind). Left rail: markets + watchlist. Centre: the selected instrument,
// its chart, gainers/losers. Right rail: the Horizon agent (wired in P3). Real data throughout.

type Quote = { price: number; changePct: number };
type Mover = { symbol: string; name: string; price: number; changePct: number };
const RANGES = ["1m", "3m", "6m", "1y"] as const;
type Range = (typeof RANGES)[number];
const logo = (s: string) => `https://financialmodelingprep.com/image-stock/${s}.png`;
const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

function Logo({ s, size = 18 }: { s: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) return <span className="grid shrink-0 place-items-center rounded-full bg-white/10 font-mono text-[8px] text-foreground/60" style={{ width: size, height: size }}>{s.slice(0, 2)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logo(s)} alt="" width={size} height={size} onError={() => setErr(true)} className="shrink-0 rounded-full bg-white object-contain" style={{ width: size, height: size }} />;
}

// A titled, numbered pane — the Bloomberg tell.
function Pane({ n, title, right, children, className = "", bodyClass = "" }: { n: number; title: string; right?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`flex min-h-0 flex-col overflow-hidden border border-border bg-[#0b0b0d]/70 backdrop-blur-sm ${className}`}>
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <span className="grid h-4 w-4 place-items-center rounded-[3px] bg-signal/15 font-mono text-[9px] text-signal">{n}</span>
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">{title}</span>
        </div>
        {right}
      </header>
      <div className={`min-h-0 flex-1 overflow-auto ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function TerminalShell() {
  const [selected, setSelected] = useState("NVDA");
  const [range, setRange] = useState<Range>("3m");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);
  const [session, setSession] = useState("");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [head, setHead] = useState<{ price: number; prevClose: number } | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [indices, setIndices] = useState<{ label: string; changePct: number; price: number }[]>([]);
  const [watch, setWatch] = useState<string[]>([]);
  const chartRef = useRef<ChartHandle>(null);
  const cursorRef = useRef<CursorHandle>(null);
  const [messages, setMessages] = useState<HMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => { unlockVault(); }, []); // decrypt the BYOK vault so Horizon can reach a key

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // execute the agent's actions on the terminal, moving the visible cursor as it goes
  const dispatch = async (actions: HAction[]) => {
    const cur = cursorRef.current, chart = chartRef.current;
    for (const a of actions) {
      try {
        if (a.tool === "selectSymbol") { setStatus(`opening ${a.symbol}…`); setSelected(a.symbol); await wait(900); }
        else if (a.tool === "setTimeframe") { setStatus(`${a.range} view`); setRange(a.range); await wait(600); }
        else if (a.tool === "addIndicator") { setStatus(`adding ${a.name}`); chart?.addIndicator(a.name); await wait(500); }
        else if (a.tool === "clearIndicators") { chart?.removeIndicators(); await wait(300); }
        else if (a.tool === "clearDrawings") { chart?.clearOverlays(); await wait(250); }
        else if (a.tool === "drawHLine") {
          setStatus(`drawing ${a.label || "level"} @ ${a.price}`);
          const xy = chart?.coord(chart?.lastTimestamp() ?? 0, a.price);
          if (cur && xy) { cur.show(a.label || "level"); await cur.moveTo(xy.x, xy.y); await cur.press(); }
          chart?.drawHLine(a.price); await wait(500);
        } else if (a.tool === "drawTrendline") {
          setStatus(`drawing ${a.label || "trend"}`);
          const f = chart?.coord(a.from.t * 1000, a.from.price);
          const t = chart?.coord(a.to.t * 1000, a.to.price);
          if (cur && f) { cur.show(a.label || "trend"); await cur.moveTo(f.x, f.y); await cur.press(); }
          chart?.createOverlay("segment", [{ timestamp: a.from.t * 1000, value: a.from.price }, { timestamp: a.to.t * 1000, value: a.to.price }]);
          if (cur && t) await cur.moveTo(t.x, t.y, true);
          await wait(450);
        } else if (a.tool === "marker") {
          setStatus(`marking ${a.text}`);
          const xy = chart?.coord(a.t * 1000, a.price);
          if (cur && xy) { cur.show(a.text.slice(0, 14)); await cur.moveTo(xy.x, xy.y); await cur.press(); }
          chart?.createOverlay("simpleAnnotation", [{ timestamp: a.t * 1000, value: a.price }], { extendData: a.text });
          await wait(450);
        } else if (a.tool === "checkNews") {
          const sym = a.symbol || selected; setStatus(`checking ${sym} news…`);
          const news = await fetch(`/api/quant/news?symbol=${encodeURIComponent(sym)}`).then((r) => r.json()).catch(() => null);
          const items = (news?.items || []).slice(0, 4).map((n: { title: string; source: string }) => `· ${n.title} — ${n.source}`).join("\n");
          setMessages((m) => [...m, { role: "assistant", content: items ? `headlines on ${sym}:\n${items}` : `no fresh headlines on ${sym}.` }]);
          await wait(300);
        } else if (a.tool === "proposeTrade") {
          setMessages((m) => [...m, { role: "assistant", content: `⚑ proposed: ${a.side} $${a.amount} of ${a.symbol} — wallet signing arrives in the trades pass.` }]);
          await wait(250);
        }
      } catch { /* one bad action shouldn't kill the sequence */ }
    }
    cur?.hide();
  };

  const ask = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    const userMsg: HMsg = { role: "user", content: t };
    setMessages((m) => [...m, userMsg]);
    setBusy(true); setStatus("reading the tape…");
    // /demo — a keyless preview of Horizon operating the chart, built from the REAL loaded candles
    if (t.toLowerCase() === "/demo") {
      try {
        const c = candles;
        if (c.length > 20) {
          const lo = c.reduce((a, k) => (k.l < a.l ? k : a), c[0]);
          const hi = c.reduce((a, k) => (k.h > a.h ? k : a), c[0]);
          const a1 = c[Math.floor(c.length * 0.15)], a2 = c[c.length - 2];
          setMessages((m) => [...m, { role: "assistant", content: `${selected}: adding a moving average, drawing the trend off the early low, marking support and the swing high.` }]);
          await dispatch([
            { tool: "addIndicator", name: "MA" },
            { tool: "drawTrendline", from: { t: a1.t, price: a1.l }, to: { t: a2.t, price: a2.c }, label: "trend" },
            { tool: "drawHLine", price: lo.l, label: "support" },
            { tool: "marker", t: hi.t, price: hi.h, text: "swing high" },
          ]);
        } else setMessages((m) => [...m, { role: "assistant", content: "load a chart first, then /demo." }]);
      } finally { setBusy(false); setStatus(""); cursorRef.current?.hide(); }
      return;
    }
    try {
      const reply = await runHorizon(t, { symbol: selected, range, candles, indicators: null, universe: STOCKS.map((s) => s.symbol) }, [...messages, userMsg]);
      if (reply.say) setMessages((m) => [...m, { role: "assistant", content: reply.say }]);
      await dispatch(reply.actions);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `hit a snag — ${(e as Error)?.message || "try again"}` }]);
    } finally { setBusy(false); setStatus(""); cursorRef.current?.hide(); }
  };

  // watchlist (localStorage)
  useEffect(() => { try { setWatch(JSON.parse(localStorage.getItem("urizen.terminal.watch") || "[\"NVDA\",\"TSLA\",\"SPY\"]")); } catch { setWatch(["NVDA", "TSLA", "SPY"]); } }, []);
  const toggleWatch = (s: string) => setWatch((w) => { const next = w.includes(s) ? w.filter((x) => x !== s) : [...w, s]; localStorage.setItem("urizen.terminal.watch", JSON.stringify(next)); return next; });

  // markets: real movers → quote map + gainers/losers
  useEffect(() => {
    let on = true;
    const load = () => fetch("/api/quant/movers").then((r) => r.json()).then((d) => {
      if (!on) return;
      const g: Mover[] = d?.gainers || [], l: Mover[] = d?.losers || [];
      setGainers(g); setLosers(l); setSession(d?.session || "");
      const map: Record<string, Quote> = {};
      [...g, ...l].forEach((m) => { map[m.symbol] = { price: m.price, changePct: m.changePct }; });
      setQuotes(map);
    }).catch(() => {});
    load(); const id = setInterval(load, 30000);
    return () => { on = false; clearInterval(id); };
  }, []);

  // indices strip
  useEffect(() => {
    fetch("/api/quant/market").then((r) => r.json()).then((d) => {
      const want = ["S&P 500", "Nasdaq", "Dow", "VIX"];
      setIndices((d?.items || []).filter((m: { label: string }) => want.includes(m.label)));
    }).catch(() => {});
  }, []);

  // chart for the selected instrument
  useEffect(() => {
    let on = true; setLoadingChart(true);
    fetch(`/api/quant/ohlc?symbol=${encodeURIComponent(selected)}&range=${range}`).then((r) => r.json()).then((d) => {
      if (!on) return;
      setCandles(d?.candles || []);
      setHead(d?.price != null ? { price: d.price, prevClose: d.prevClose } : null);
    }).catch(() => {}).finally(() => on && setLoadingChart(false));
    return () => { on = false; };
  }, [selected, range]);

  const changePct = head ? (head.price / head.prevClose - 1) * 100 : (quotes[selected]?.changePct ?? 0);
  const up = changePct >= 0;
  const sel = STOCKS.find((s) => s.symbol === selected);

  const universe = useMemo(() => STOCKS.map((s) => ({ ...s, q: quotes[s.symbol] })), [quotes]);

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-[#0a0a0b] text-foreground">
      {/* faint Blake compass behind everything */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-[0.10]"><AncientOfDays className="h-full w-full" /></div>
      {/* the visible Horizon cursor (fixed overlay) */}
      <HorizonCursor ref={cursorRef} />

      {/* ── top bar ── */}
      <header className="relative z-10 flex h-[52px] shrink-0 items-center gap-4 border-b border-border bg-[#0a0a0b]/80 px-4 backdrop-blur-md">
        <a href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-[5px] bg-signal/15"><UrizenMark className="h-3.5 w-auto text-signal" /></span>
          <span className="font-display text-[15px] font-bold tracking-tight">Terminal</span>
          <span className="hidden rounded-full border border-white/15 px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground sm:inline">URIZEN</span>
        </a>
        <div className="relative hidden max-w-md flex-1 items-center sm:flex">
          <SymbolSearch onPick={setSelected} />
        </div>
        <div className="ml-auto flex items-center gap-4">
          <MarketClock />
          <ConnectButton chainStatus="icon" showBalance={false} accountStatus="avatar" />
        </div>
      </header>

      {/* ── body: three rails ── */}
      <div className="relative z-10 grid min-h-0 flex-1 gap-2 p-2" style={{ gridTemplateColumns: "minmax(230px,260px) minmax(0,1fr) minmax(320px,380px)" }}>
        {/* LEFT: markets + watchlist */}
        <div className="grid min-h-0 grid-rows-[1.6fr_1fr] gap-2">
          <Pane n={1} title="Markets" right={<span className="font-mono text-[0.6rem] text-muted-foreground">{session || "24/7"}</span>}>
            <table className="w-full border-collapse text-[0.78rem]">
              <tbody>
                {universe.map((s) => {
                  const on = s.symbol === selected;
                  return (
                    <tr key={s.symbol} onClick={() => setSelected(s.symbol)}
                      className={`cursor-pointer border-b border-border/40 transition-colors ${on ? "bg-signal/10" : "hover:bg-white/[0.03]"}`}>
                      <td className="py-1.5 pl-3 pr-1"><button onClick={(e) => { e.stopPropagation(); toggleWatch(s.symbol); }} className={watch.includes(s.symbol) ? "text-signal" : "text-muted-foreground/40 hover:text-muted-foreground"}>★</button></td>
                      <td className="py-1.5 pr-2"><div className="flex items-center gap-2"><Logo s={s.symbol} /><span className={`font-mono ${on ? "text-signal" : "text-foreground"}`}>{s.symbol}</span></div></td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums text-foreground/90">{s.q ? fmt(s.q.price) : "—"}</td>
                      <td className={`py-1.5 pr-3 text-right font-mono tabular-nums ${s.q ? (s.q.changePct >= 0 ? "text-signal" : "text-[#ff5a5a]") : "text-muted-foreground/40"}`}>{s.q ? pct(s.q.changePct) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Pane>
          <Pane n={2} title="Watchlist">
            {watch.length === 0 ? <Empty>★ a market to pin it</Empty> : (
              <table className="w-full border-collapse text-[0.78rem]">
                <tbody>
                  {watch.map((sym) => { const q = quotes[sym]; return (
                    <tr key={sym} onClick={() => setSelected(sym)} className="cursor-pointer border-b border-border/40 hover:bg-white/[0.03]">
                      <td className="py-1.5 pl-3 pr-2"><div className="flex items-center gap-2"><Logo s={sym} size={16} /><span className="font-mono">{sym}</span></div></td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums text-foreground/90">{q ? fmt(q.price) : "—"}</td>
                      <td className={`py-1.5 pr-2 text-right font-mono tabular-nums ${q ? (q.changePct >= 0 ? "text-signal" : "text-[#ff5a5a]") : "text-muted-foreground/40"}`}>{q ? pct(q.changePct) : "—"}</td>
                      <td className="py-1.5 pr-3 text-right"><button onClick={(e) => { e.stopPropagation(); toggleWatch(sym); }} className="text-muted-foreground/40 hover:text-[#ff5a5a]">×</button></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            )}
          </Pane>
        </div>

        {/* CENTER: performance header + chart + movers */}
        <div className="grid min-h-0 grid-rows-[auto_1.7fr_1fr] gap-2">
          <Pane n={3} title={`Performance · ${selected}`} right={<a href={`https://robinhoodchain.blockscout.com/token/${sel?.address}`} target="_blank" rel="noreferrer" className="font-mono text-[0.6rem] text-muted-foreground hover:text-signal">contract ↗</a>}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
              <div className="flex items-center gap-3">
                <Logo s={selected} size={26} />
                <div>
                  <div className="font-display text-lg leading-none">{sel?.name ?? selected}</div>
                  <div className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground">{selected} · {sel?.kind === "etf" ? "ETF" : "Equity"}</div>
                </div>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-2xl tabular-nums">${head ? fmt(head.price) : (quotes[selected] ? fmt(quotes[selected].price) : "—")}</span>
                <span className={`font-mono text-sm tabular-nums ${up ? "text-signal" : "text-[#ff5a5a]"}`}>{up ? "▲" : "▼"} {pct(changePct)}</span>
              </div>
              {session && <span className="ml-auto rounded-full border border-signal/30 bg-signal/10 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-widest text-signal">{session}</span>}
            </div>
          </Pane>

          <Pane n={4} title={`Chart · ${selected}`} right={
            <div className="flex items-center gap-1">
              {RANGES.map((r) => <button key={r} onClick={() => setRange(r)} className={`rounded px-1.5 py-0.5 font-mono text-[0.6rem] uppercase transition-colors ${range === r ? "bg-signal/15 text-signal" : "text-muted-foreground hover:text-foreground"}`}>{r}</button>)}
            </div>
          } bodyClass="relative">
            <KlineChart ref={chartRef} candles={candles} symbol={selected} />
            {loadingChart && candles.length === 0 && <div className="absolute inset-0 grid place-items-center font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground/50">loading tape…</div>}
            {/* agent drawing + live cursor land in P3 */}
            <div className="pointer-events-none absolute bottom-1.5 right-3 font-mono text-[0.55rem] uppercase tracking-widest text-muted-foreground/40">agent drawing · P3</div>
          </Pane>

          <div className="grid min-h-0 grid-cols-2 gap-2">
            <MoversPane n={5} title="Top gainers" rows={gainers} onPick={setSelected} up />
            <MoversPane n={6} title="Top losers" rows={losers} onPick={setSelected} />
          </div>
        </div>

        {/* RIGHT: Horizon agent */}
        <HorizonRail selected={selected} messages={messages} busy={busy} status={status} onAsk={ask} />
      </div>

      {/* ── bottom status bar ── */}
      <footer className="relative z-10 flex h-7 shrink-0 items-center gap-4 border-t border-border bg-[#0a0a0b]/90 px-4 font-mono text-[0.62rem] text-muted-foreground">
        <span className="text-signal">● horizon</span>
        {indices.map((m) => <span key={m.label} className="hidden items-center gap-1.5 sm:inline-flex">{m.label} <span className={m.changePct >= 0 ? "text-signal" : "text-[#ff5a5a]"}>{pct(m.changePct)}</span></span>)}
        <span className="ml-auto hidden gap-4 md:flex">
          <span><kbd className="text-foreground">/</kbd> search</span>
          <span><kbd className="text-foreground">1–8</kbd> panes</span>
          <span><kbd className="text-foreground">⌘K</kbd> horizon</span>
        </span>
      </footer>
    </main>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground/50">{children}</div>;
}


function MoversPane({ n, title, rows, onPick, up }: { n: number; title: string; rows: Mover[]; onPick: (s: string) => void; up?: boolean }) {
  return (
    <Pane n={n} title={title}>
      {rows.length === 0 ? <Empty>loading…</Empty> : (
        <table className="w-full border-collapse text-[0.74rem]">
          <tbody>
            {rows.slice(0, 8).map((m) => (
              <tr key={m.symbol} onClick={() => onPick(m.symbol)} className="cursor-pointer border-b border-border/40 hover:bg-white/[0.03]">
                <td className="py-1 pl-3 pr-2"><div className="flex items-center gap-1.5"><Logo s={m.symbol} size={14} /><span className="font-mono">{m.symbol}</span></div></td>
                <td className="py-1 pr-2 text-right font-mono tabular-nums text-foreground/80">{fmt(m.price)}</td>
                <td className={`py-1 pr-3 text-right font-mono tabular-nums ${up ? "text-signal" : "text-[#ff5a5a]"}`}>{pct(m.changePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Pane>
  );
}

// ── Horizon agent rail — a real chat that operates the terminal ──
function HorizonRail({ selected, messages, busy, status, onAsk }: { selected: string; messages: HMsg[]; busy: boolean; status: string; onAsk: (t: string) => void }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const examples = [
    `analyse ${selected} and draw the trend`,
    "mark support and resistance",
    "add a 50-day MA and RSI",
    `any news moving ${selected}?`,
  ];
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, status]);
  const send = () => { const t = input; setInput(""); onAsk(t); };

  return (
    <Pane n={7} title="Horizon" right={<span className="flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-widest text-signal"><span className={`h-1.5 w-1.5 rounded-full bg-signal ${busy ? "animate-ping" : "animate-pulse"}`} />{busy ? "working" : "online"}</span>} bodyClass="flex flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-signal/40 bg-signal/10"><UrizenMark className="h-3.5 w-auto text-signal" /></span>
              <div className="rounded-xl rounded-tl-sm border border-border bg-white/[0.03] p-3 text-[0.82rem] leading-relaxed text-foreground/90">
                i&apos;m Horizon. tell me what to look at — i&apos;ll read the tape, draw on the chart, pull news, and set up trades for you to sign.
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="font-mono text-[0.58rem] uppercase tracking-widest text-muted-foreground/60">try</div>
              {examples.map((e) => (
                <button key={e} onClick={() => onAsk(e)} className="block w-full truncate rounded-lg border border-border bg-white/[0.02] px-3 py-2 text-left text-[0.78rem] text-muted-foreground transition-colors hover:border-signal/40 hover:text-foreground">{e}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => m.role === "user" ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-tr-sm border border-signal/25 bg-signal/10 px-3 py-2 text-[0.82rem] leading-relaxed text-foreground">{m.content}</div>
          </div>
        ) : (
          <div key={i} className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-signal/40 bg-signal/10"><UrizenMark className="h-3.5 w-auto text-signal" /></span>
            <div className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-tl-sm border border-border bg-white/[0.03] px-3 py-2 text-[0.82rem] leading-relaxed text-foreground/90">{m.content}</div>
          </div>
        ))}
        {busy && status && (
          <div className="flex items-center gap-2.5 pl-9 font-mono text-[0.72rem] text-signal">
            <span className="inline-flex gap-1"><span className="h-1 w-1 animate-bounce rounded-full bg-signal [animation-delay:-0.2s]" /><span className="h-1 w-1 animate-bounce rounded-full bg-signal [animation-delay:-0.1s]" /><span className="h-1 w-1 animate-bounce rounded-full bg-signal" /></span>
            {status}
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-[#0d0d10] p-1.5 focus-within:border-signal/40">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} disabled={busy}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={busy ? "Horizon is working…" : `ask Horizon about ${selected}…`}
            className="max-h-24 min-h-[2rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-[0.82rem] outline-none placeholder:text-muted-foreground/50 disabled:opacity-50" />
          <button onClick={send} disabled={busy || !input.trim()} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-signal/15 text-signal transition-colors hover:bg-signal/25 disabled:opacity-40">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M3 11l18-8-8 18-2-7-8-3z" /></svg>
          </button>
        </div>
        <div className="mt-1.5 text-center font-mono text-[0.55rem] uppercase tracking-widest text-muted-foreground/40">horizon operates the terminal · you sign every trade</div>
      </div>
    </Pane>
  );
}

// ── symbol search (client-side over the universe) ──
function SymbolSearch({ onPick }: { onPick: (s: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    const t = q.trim().toUpperCase();
    if (!t) return [];
    return STOCKS.filter((s) => s.symbol.includes(t) || s.name.toUpperCase().includes(t)).slice(0, 7);
  }, [q]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc); return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div ref={ref} className="relative w-full">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-[#0d0d10] px-3 py-1.5">
        <span className="text-muted-foreground/60">⌕</span>
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search ticker or company…"
          className="w-full bg-transparent text-[0.82rem] outline-none placeholder:text-muted-foreground/50" />
        <kbd className="rounded border border-border px-1.5 font-mono text-[0.6rem] text-muted-foreground">/</kbd>
      </div>
      {open && results.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-[#0d0d10] shadow-xl">
          {results.map((s) => (
            <button key={s.symbol} onClick={() => { onPick(s.symbol); setQ(""); setOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-signal/10">
              <Logo s={s.symbol} size={18} />
              <span className="font-mono text-[0.8rem] text-foreground">{s.symbol}</span>
              <span className="truncate text-[0.75rem] text-muted-foreground">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── market clock (NYSE-ish session read from the movers session label) ──
function MarketClock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "America/New_York" }));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  return <span className="hidden items-center gap-2 font-mono text-[0.68rem] text-muted-foreground md:flex"><span className="h-1.5 w-1.5 rounded-full bg-signal" />{now} <span className="text-muted-foreground/50">ET</span></span>;
}
