"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { type ChartHandle } from "@/components/terminal/kline-chart";
import { HorizonCursor, type CursorHandle } from "@/components/terminal/horizon-cursor";
import { TradeTicket, type ProposedTrade } from "@/components/terminal/trade-ticket";
import { ChartWorkspace } from "@/components/terminal/chart-workspace";
import { KeyModal, InlineKeySetup } from "@/components/terminal/key-modal";
import { NewsPanel, RatingsPanel, FundamentalsPanel, MacroPanel, PredictionsPanel, OnchainPanel } from "@/components/terminal/data-panels";
import { TVEconCalendar, TVHeatmap } from "@/components/terminal/tv-widgets";
import { UrizenMark } from "@/components/brand/marks";
import { STOCKS } from "@/lib/stocks";
import { runHorizon, type HAction, type HMsg } from "@/lib/horizon";
import { unlockVault, listAgents, saveAgent, type Agent } from "@/lib/agents";
import { NewAgentModal } from "@/components/alpha/new-agent-modal";
import { matchSlash, resolveSlashCommand, SlashMenu, SkillsModal } from "@/components/alpha/skills-panel";
import { ALL_SKILL_IDS } from "@/components/alpha/skills";
import { matchAt, type Source } from "@/components/alpha/sources";
import { Thinking } from "@/components/alpha/thinking";
import type { Candle } from "@/lib/quant";

// ── Horizon Terminal — P1 shell ──────────────────────────────────────────────
// Numbered-pane Bloomberg layout in our identity (signal green on near-black, a faint Blake
// "Ancient of Days" behind). Left rail: markets + watchlist. Centre: the selected instrument,
// its chart, gainers/losers. Right rail: the Horizon agent (wired in P3). Real data throughout.

type Quote = { price: number; changePct: number };
type Mover = { symbol: string; name: string; price: number; changePct: number };
const RANGES = ["1D", "5D", "1M", "3M", "6M", "1Y"] as const;
type Range = (typeof RANGES)[number];
const logo = (s: string) => `https://financialmodelingprep.com/image-stock/${s}.png`;
const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

// the panels the user (and the agent) can add/close in the centre workspace
const ALL_PANELS: { id: string; title: string }[] = [
  { id: "watch", title: "Watchlist" }, { id: "news", title: "News" }, { id: "gainers", title: "Top gainers" }, { id: "losers", title: "Top losers" },
  { id: "ratings", title: "Analyst ratings" }, { id: "fundamentals", title: "Fundamentals" },
  { id: "macro", title: "Macro" }, { id: "predictions", title: "Prediction markets" }, { id: "onchain", title: "On-chain" },
  { id: "calendar", title: "Economic calendar" }, { id: "heatmap", title: "Heatmap" },
];

function Logo({ s, size = 18 }: { s: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) return <span className="grid shrink-0 place-items-center rounded-full bg-white/10 font-mono text-[8px] text-foreground/60" style={{ width: size, height: size }}>{s.slice(0, 2)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logo(s)} alt="" width={size} height={size} onError={() => setErr(true)} className="shrink-0 rounded-full bg-white object-contain" style={{ width: size, height: size }} />;
}

// A titled, numbered pane — the Bloomberg tell.
function Pane({ n, title, right, children, className = "", bodyClass = "", onClose, onExpand }: { n?: number; title: string; right?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string; onClose?: () => void; onExpand?: () => void }) {
  return (
    <section className={`flex min-h-0 flex-col overflow-hidden border border-border bg-[#0b0b0d]/62 backdrop-blur-md ${className}`}>
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          {n != null && <span className="grid h-4 w-4 place-items-center rounded-[3px] bg-signal/15 font-mono text-[9px] text-signal">{n}</span>}
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {right}
          {onExpand && <button onClick={onExpand} title="expand" className="font-mono text-[0.8rem] leading-none text-muted-foreground/50 transition-colors hover:text-signal">⤢</button>}
          {onClose && <button onClick={onClose} title="close panel" className="font-mono text-[0.85rem] leading-none text-muted-foreground/50 transition-colors hover:text-[#ff5a5a]">×</button>}
        </div>
      </header>
      <div className={`min-h-0 flex-1 overflow-auto ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function TerminalShell() {
  const [charts, setCharts] = useState<{ id: string; symbol: string }[]>([{ id: "c1", symbol: "NVDA" }]);
  const [activeId, setActiveId] = useState("c1");
  const cidRef = useRef(1);
  const [range, setRange] = useState<Range>("3M");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);
  const [session, setSession] = useState("");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [head, setHead] = useState<{ price: number; prevClose: number } | null>(null);
  const [indices, setIndices] = useState<{ label: string; changePct: number; price: number }[]>([]);
  const [watch, setWatch] = useState<string[]>([]);
  const handlesRef = useRef<Record<string, ChartHandle | null>>({});
  const cursorRef = useRef<CursorHandle>(null);
  const [messages, setMessages] = useState<HMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [pendingTrade, setPendingTrade] = useState<ProposedTrade | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  // ONE big board pop-up that holds MULTIPLE panel tiles (the user + agent add into it). Dims the
  // background; tiled by default, draggable when the user flips the drag toggle.
  const [panelOpen, setPanelOpen] = useState(false);
  const [panels, setPanels] = useState<string[]>([]);
  // named agent personas (persisted in the browser, shared with Alpha via urizen.agents.v1)
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const { address, isConnected } = useAccount();

  useEffect(() => { setAgents(listAgents()); try { setAgentId(localStorage.getItem("urizen.terminal.agent")); } catch { /* noop */ } }, []);
  const activeAgent = agents.find((a) => a.id === agentId) ?? agents[0] ?? null;
  const selectAgent = (id: string) => { setAgentId(id); try { localStorage.setItem("urizen.terminal.agent", id); } catch { /* noop */ } };
  const createAgent = (a: Agent) => { const all = saveAgent({ ...a, owner: address ?? undefined }); setAgents(all); selectAgent(a.id); setNewAgentOpen(false); };
  const persona = activeAgent ? { name: activeAgent.name, mandate: activeAgent.mandate, risk: activeAgent.risk, note: activeAgent.note } : null;

  useEffect(() => { try { const s = localStorage.getItem("urizen.terminal.board"); if (s) { const ids = JSON.parse(s); if (Array.isArray(ids)) setPanels(ids.filter((id: string) => ALL_PANELS.some((p) => p.id === id))); } } catch { /* noop */ } }, []);
  const persist = (next: string[]) => { try { localStorage.setItem("urizen.terminal.board", JSON.stringify(next)); } catch { /* noop */ } return next; };
  const openPanel = (id: string) => { if (!ALL_PANELS.some((p) => p.id === id)) return; setPanels((prev) => persist(prev.includes(id) ? prev : [...prev, id])); setPanelOpen(true); };
  const closeTile = (id: string) => setPanels((prev) => persist(prev.filter((p) => p !== id)));
  const closePanel = () => setPanelOpen(false);
  const renderPanelBody = (id: string) => {
    switch (id) {
      case "watch": return <WatchBody watch={watch} quotes={quotes} onPick={(s) => { setSelected(s); }} onRemove={toggleWatch} />;
      case "gainers": return <MoversBody rows={gainers} onPick={setSelected} up />;
      case "losers": return <MoversBody rows={losers} onPick={setSelected} />;
      case "news": return <NewsPanel symbol={selected} />;
      case "calendar": return <TVEconCalendar />;
      case "heatmap": return <TVHeatmap />;
      case "ratings": return <RatingsPanel symbol={selected} />;
      case "fundamentals": return <FundamentalsPanel symbol={selected} />;
      case "macro": return <MacroPanel />;
      case "predictions": return <PredictionsPanel symbol={selected} />;
      case "onchain": return <OnchainPanel symbol={selected} />;
      default: return null;
    }
  };

  // the active chart drives the header / trade / agent grounding; setSelected retargets it
  const activeChart = charts.find((c) => c.id === activeId) ?? charts[0];
  const selected = activeChart?.symbol ?? "NVDA";
  const setSelected = (sym: string) => setCharts((cs) => cs.map((c) => (c.id === activeId ? { ...c, symbol: sym } : c)));
  const activeHandle = () => handlesRef.current[activeId] ?? null;
  const openChart = (sym: string) => {
    if (charts.length >= 4) { setSelected(sym); return; }
    const id = `c${++cidRef.current}`;
    setCharts((cs) => [...cs, { id, symbol: sym }]);
    setActiveId(id);
  };
  const closeChart = (id: string) => setCharts((cs) => {
    if (cs.length <= 1) return cs;
    const next = cs.filter((c) => c.id !== id);
    if (id === activeId) setActiveId(next[0].id);
    delete handlesRef.current[id];
    return next;
  });

  useEffect(() => { unlockVault(); }, []); // decrypt the BYOK vault so Horizon can reach a key

  const clearDrawings = () => handlesRef.current[activeId]?.clearOverlays();
  const clearIndicators = () => handlesRef.current[activeId]?.removeIndicators();
  const startDraw = (name: string) => handlesRef.current[activeId]?.startDraw(name);
  // Delete / Backspace removes the last drawing (then the last indicator) off the active chart
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const h = handlesRef.current[activeId];
      if (h && (h.removeLastOverlay() || h.removeLastIndicator())) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId]);

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // execute the agent's actions on the terminal, moving the visible cursor as it goes
  const dispatch = async (actions: HAction[]) => {
    const cur = cursorRef.current;
    // guard against a misbehaving model: cap the run and drop duplicate actions (the "spam" bug)
    const seen = new Set<string>();
    const list = (actions || []).slice(0, 8).filter((a) => { const k = JSON.stringify(a); if (seen.has(k)) return false; seen.add(k); return true; });
    for (const a of list) {
      const chart = activeHandle();
      try {
        if (a.tool === "selectSymbol") { setStatus(`opening ${a.symbol}…`); setSelected(a.symbol); await wait(900); }
        else if (a.tool === "openChart") { setStatus(`opening a ${a.symbol} chart…`); openChart(a.symbol); await wait(1000); }
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
        } else if (a.tool === "openPanel") { setStatus(`opening ${a.panel}`); openPanel(a.panel); await wait(500);
        } else if (a.tool === "closePanel") { closeTile(a.panel); await wait(300);
        } else if (a.tool === "checkNews") {
          const sym = a.symbol || selected; setStatus(`checking ${sym} news…`);
          const news = await fetch(`/api/quant/news?symbol=${encodeURIComponent(sym)}`).then((r) => r.json()).catch(() => null);
          const items = (news?.items || []).slice(0, 4).map((n: { title: string; source: string }) => `· ${n.title} — ${n.source}`).join("\n");
          setMessages((m) => [...m, { role: "assistant", content: items ? `headlines on ${sym}:\n${items}` : `no fresh headlines on ${sym}.` }]);
          await wait(300);
        } else if (a.tool === "proposeTrade") {
          setStatus(`preparing ${a.side} ${a.symbol}…`);
          setPendingTrade({ side: a.side, symbol: a.symbol, amount: a.amount, note: `the agent suggests ${a.side === "buy" ? "buying" : "selling"} ${a.symbol}.` });
          await wait(300);
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
    // /buy|/sell SYM AMT — raise a trade ticket directly (keyless test of the wallet flow)
    const tc = t.match(/^\/(buy|sell)\s+([A-Za-z]+)\s+([\d.]+)/i);
    if (tc) {
      setBusy(false); setStatus("");
      setMessages((m) => [...m, { role: "assistant", content: `raising a ${tc[1].toLowerCase()} ticket for ${tc[2].toUpperCase()}.` }]);
      setPendingTrade({ side: tc[1].toLowerCase() as "buy" | "sell", symbol: tc[2].toUpperCase(), amount: parseFloat(tc[3]), note: "manual ticket" });
      return;
    }
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
    const history = [...messages, userMsg];
    setMessages((m) => [...m, { role: "assistant", content: "" }]); // the bubble we stream into
    const patchLast = (content: string) => setMessages((m) => { const c = [...m]; for (let i = c.length - 1; i >= 0; i--) { if (c[i].role === "assistant") { c[i] = { ...c[i], content }; break; } } return c; });
    try {
      const reply = await runHorizon(t, { symbol: selected, range, candles, indicators: null, universe: STOCKS.map((s) => s.symbol), persona }, history, {
        onStatus: (s) => setStatus(s),
        onText: (visible) => { if (visible) patchLast(visible); },
      });
      patchLast(reply.say || "…");
      await dispatch(reply.actions);
    } catch (e) {
      patchLast(`hit a snag — ${(e as Error)?.message || "try again"}`);
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
    let on = true;
    // the active symbol's candles power the performance header + Horizon's grounding
    fetch(`/api/quant/ohlc?symbol=${encodeURIComponent(selected)}&range=${range}`).then((r) => r.json()).then((d) => {
      if (!on) return;
      setCandles(d?.candles || []);
      setHead(d?.price != null ? { price: d.price, prevClose: d.prevClose } : null);
    }).catch(() => {});
    return () => { on = false; };
  }, [selected, range]);

  const changePct = head ? (head.price / head.prevClose - 1) * 100 : (quotes[selected]?.changePct ?? 0);
  const up = changePct >= 0;
  const sel = STOCKS.find((s) => s.symbol === selected);

  const universe = useMemo(() => STOCKS.map((s) => ({ ...s, q: quotes[s.symbol] })), [quotes]);

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-[#0a0a0b] text-foreground">
      {/* William Blake — the "Ancient of Days" painting on the right (measuring the deep with a
          compass), desaturated and masked into the dark, over faint engraved outlines + a green wash.
          Sophisticated, present, never loud — the terminal's signature. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-[#08080a]">
        {/* a single, STILL William Blake painting — no animation. Desaturated, veiled for legibility. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/blake-ancient.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_14%] opacity-[0.2] grayscale contrast-[1.15]" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(50% 45% at 42% 20%, rgba(52,240,3,0.05), transparent 66%), linear-gradient(180deg, rgba(8,8,10,0.45) 0%, rgba(8,8,10,0.66) 100%)" }} />
      </div>
      {/* the visible agent cursor (fixed overlay) */}
      <HorizonCursor ref={cursorRef} />
      <KeyModal open={keyOpen} onClose={() => setKeyOpen(false)} onChanged={() => {}} />
      {newAgentOpen && <NewAgentModal onClose={() => setNewAgentOpen(false)} onCreate={createAgent} />}

      {/* ── top bar ── */}
      <header className="relative z-40 flex h-[52px] shrink-0 items-center gap-4 border-b border-border bg-[#0a0a0b]/80 px-4 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-[5px] bg-signal/15"><UrizenMark className="h-3.5 w-auto text-signal" /></span>
          <span className="font-display text-[15px] font-bold tracking-tight">Terminal</span>
          <span className="hidden rounded-full border border-white/15 px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground sm:inline">URIZEN</span>
        </Link>
        <div className="relative hidden max-w-md flex-1 items-center sm:flex">
          <SymbolSearch onPick={setSelected} quotes={quotes} />
        </div>
        <div className="ml-auto flex items-center gap-4">
          <MarketClock />
          <ConnectWalletButton />
        </div>
      </header>

      {/* ── compact ticker ribbon (our data, our style) ── */}
      <div className="relative z-10 flex h-7 shrink-0 items-center overflow-hidden border-b border-border bg-[#0a0a0b]/60">
        <TickerRibbon indices={indices} quotes={quotes} />
      </div>

      {/* ── body: three rails ── */}
      <div className="relative z-10 grid min-h-0 flex-1 gap-2 p-2" style={{ gridTemplateColumns: "minmax(215px,245px) minmax(0,1fr) minmax(400px,460px)" }}>
        {/* LEFT: markets + watchlist */}
        <div className="grid min-h-0 grid-rows-[1.6fr_1fr] gap-2">
          <Pane n={1} title="Markets" right={<span className="font-mono text-[0.6rem] text-muted-foreground">{session || "24/7"}</span>}>
            <table className="w-full border-collapse text-[0.78rem]">
              <tbody>
                {universe.map((s) => {
                  const on = s.symbol === selected;
                  return (
                    <tr key={s.symbol} onClick={() => setSelected(s.symbol)}
                      className={`group cursor-pointer border-b border-border/40 transition-colors ${on ? "bg-signal/10" : "hover:bg-white/[0.03]"}`}>
                      <td className="py-1.5 pl-3 pr-1"><button onClick={(e) => { e.stopPropagation(); toggleWatch(s.symbol); }} className={watch.includes(s.symbol) ? "text-signal" : "text-muted-foreground/40 hover:text-muted-foreground"}>★</button></td>
                      <td className="py-1.5 pr-2"><div className="flex items-center gap-2"><Logo s={s.symbol} /><span className={`font-mono ${on ? "text-signal" : "text-foreground"}`}>{s.symbol}</span><button onClick={(e) => { e.stopPropagation(); openChart(s.symbol); }} title="open as a new chart" className="font-mono text-[0.72rem] leading-none text-muted-foreground/40 opacity-0 transition-opacity hover:text-signal group-hover:opacity-100">＋</button></div></td>
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

        {/* CENTER: one big, vanilla chart. Its 44px header carries the instrument, price and tools —
            no separate performance pane. Secondary panels open in a single unified dock (below). */}
        <section className="flex min-h-0 flex-col overflow-hidden border border-border bg-[#0b0b0d]/62 backdrop-blur-md">
          <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border pl-3 pr-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Logo s={selected} size={22} />
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="truncate font-display text-[0.95rem] leading-none">{sel?.name ?? selected}</span>
                <span className="shrink-0 font-mono text-[0.56rem] uppercase tracking-[0.14em] text-muted-foreground/70">{selected}</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-lg leading-none tabular-nums">${head ? fmt(head.price) : (quotes[selected] ? fmt(quotes[selected].price) : "—")}</span>
              <span className={`font-mono text-[0.78rem] tabular-nums ${up ? "text-signal" : "text-[#ff5a5a]"}`}>{up ? "▲" : "▼"} {pct(changePct)}</span>
            </div>
            {session && <span className="hidden shrink-0 rounded-full border border-signal/25 bg-signal/10 px-2 py-0.5 font-mono text-[0.54rem] uppercase tracking-widest text-signal xl:inline">{session}</span>}
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <div className="flex items-center rounded-md border border-border p-0.5">
                {RANGES.map((r) => <button key={r} onClick={() => setRange(r)} className={`rounded px-1.5 py-0.5 font-mono text-[0.6rem] uppercase transition-colors ${range === r ? "bg-signal/15 text-signal" : "text-muted-foreground hover:text-foreground"}`}>{r}</button>)}
              </div>
              {/* draw on the chart yourself — pick a tool, then click the chart to place it */}
              <DrawMenu onDraw={startDraw} />
              {/* erase what's on the chart — drawings, then indicators (Del key also removes the last one) */}
              <div className="hidden items-center rounded-md border border-border p-0.5 md:flex">
                <button onClick={clearDrawings} title="clear drawings (Del)" className="grid h-5 w-6 place-items-center rounded font-mono text-[0.72rem] leading-none text-muted-foreground transition-colors hover:bg-white/5 hover:text-[#ff5a5a]">⌫</button>
                <button onClick={clearIndicators} title="clear indicators" className="grid h-5 w-6 place-items-center rounded font-mono text-[0.72rem] leading-none text-muted-foreground transition-colors hover:bg-white/5 hover:text-[#ff5a5a]">∿</button>
              </div>
              <AddChartButton disabled={charts.length >= 4} onPick={openChart} quotes={quotes} openSymbols={charts.map((c) => c.symbol)} />
              <button onClick={() => setPanelOpen(true)} title="panels (news, ratings, watch…)" className={`flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wide transition-colors ${panelOpen || panels.length ? "border-signal/40 text-signal" : "border-border text-muted-foreground hover:text-foreground"}`}>▦ panels{panels.length ? <span className="text-signal">· {panels.length}</span> : null}</button>
            </div>
          </header>
          <div className="min-h-0 flex-1">
            <ChartWorkspace charts={charts} activeId={activeId} range={range} onFocus={setActiveId} onClose={closeChart} onHandle={(id, h) => { handlesRef.current[id] = h; }} />
          </div>
        </section>

        {/* RIGHT: the terminal agent */}
        <HorizonRail selected={selected} messages={messages} busy={busy} status={status} onAsk={ask}
          pendingTrade={pendingTrade} taker={address ?? null} onClearTrade={() => setPendingTrade(null)} onSettings={() => setKeyOpen(true)} connected={isConnected}
          agents={agents} activeAgent={activeAgent} onSelectAgent={selectAgent} onNewAgent={() => setNewAgentOpen(true)} />
      </div>

      {/* ONE big board — a dimmed-backdrop pop-up that holds MULTIPLE panel tiles. Add as many as you
          like (news + ratings + watch…), tiled by default, draggable when you flip the toggle. */}
      <CommandBoard open={panelOpen} panels={panels} onAdd={openPanel} onCloseTile={closeTile} onClose={closePanel} render={renderPanelBody} />

      {/* ── bottom status bar ── */}
      <footer className="relative z-10 flex h-7 shrink-0 items-center gap-4 border-t border-border bg-[#0a0a0b]/90 px-4 font-mono text-[0.62rem] text-muted-foreground">
        <span className="flex items-center gap-1.5 text-signal"><span className="h-1.5 w-1.5 rounded-full bg-signal" />terminal</span>
        <span className="hidden text-muted-foreground/50 sm:inline">{selected} · {range} · {charts.length} chart{charts.length === 1 ? "" : "s"}{panels.length ? ` · ${panels.length} panel${panels.length === 1 ? "" : "s"}` : ""}</span>
        <span className="ml-auto hidden gap-4 md:flex">
          <span><kbd className="text-foreground">/</kbd> search</span>
          <span><kbd className="text-foreground">+</kbd> add panel</span>
          <span><kbd className="text-foreground">↵</kbd> ask the agent</span>
        </span>
      </footer>
    </main>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground/50">{children}</div>;
}

// ── the ONE big board — a dimmed-backdrop pop-up holding MULTIPLE panel tiles. Add as many as you
// want (news + ratings + watch…); tiled by default, draggable when you flip the lock. Agent adds too. ──
function CommandBoard({ open, panels, onAdd, onCloseTile, onClose, render }: { open: boolean; panels: string[]; onAdd: (id: string) => void; onCloseTile: (id: string) => void; onClose: () => void; render: (id: string) => React.ReactNode }) {
  const [drag, setDrag] = useState(false);
  const [max, setMax] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});
  const addRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [open, onClose]);
  useEffect(() => { const h = (e: MouseEvent) => { if (addRef.current && !addRef.current.contains(e.target as Node)) setAddMenu(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 backdrop-blur-[2px] p-4" onPointerDown={onClose}>
      <div onPointerDown={(e) => e.stopPropagation()}
        style={max ? { width: "97vw", height: "92vh" } : { width: "min(1180px, 95vw)", height: "min(760px, 88vh)" }}
        className="flex flex-col overflow-hidden rounded-2xl border border-signal/25 bg-[#0a0a0c] shadow-2xl">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">Board</span>
          <span className="font-mono text-[0.58rem] text-muted-foreground/40">· {panels.length}</span>
          <div ref={addRef} className="relative ml-1">
            <button onClick={() => setAddMenu((v) => !v)} className={`flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wide transition-colors ${addMenu ? "border-signal/40 text-signal" : "border-border text-muted-foreground hover:text-foreground"}`}>＋ add panel</button>
            {addMenu && (
              <div className="absolute left-0 top-full z-[90] mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-[#0d0d10] p-1 shadow-2xl">
                {ALL_PANELS.map((p) => { const on = panels.includes(p.id); return (
                  <button key={p.id} onClick={() => { onAdd(p.id); setAddMenu(false); }} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[0.76rem] transition-colors ${on ? "text-signal" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"}`}>
                    {p.title}{on && <span className="font-mono text-[0.5rem] uppercase tracking-widest text-signal/70">open</span>}
                  </button>
                ); })}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setDrag((d) => !d)} title={drag ? "lock the layout" : "unlock to drag tiles"} className={`rounded-md border px-2 py-1 font-mono text-[0.54rem] uppercase tracking-widest transition-colors ${drag ? "border-signal/50 bg-signal/10 text-signal" : "border-border text-muted-foreground hover:text-foreground"}`}>{drag ? "◈ drag on" : "⇲ drag"}</button>
            <button onClick={() => setMax((m) => !m)} title={max ? "restore" : "maximize"} className="grid h-6 w-6 place-items-center rounded-md text-[0.8rem] text-muted-foreground/60 transition-colors hover:bg-white/5 hover:text-signal">{max ? "❐" : "⤢"}</button>
            <button onClick={onClose} title="close (Esc)" className="grid h-6 w-6 place-items-center rounded-md text-[0.95rem] leading-none text-muted-foreground/60 transition-colors hover:bg-[#ff5a5a]/15 hover:text-[#ff5a5a]">×</button>
          </div>
        </header>
        {panels.length === 0 ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div className="max-w-xs space-y-2">
              <div className="font-mono text-[0.66rem] uppercase tracking-widest text-muted-foreground/50">empty board</div>
              <div className="text-[0.84rem] leading-relaxed text-muted-foreground">add panels with <span className="text-signal">＋ add panel</span> — news, ratings, your watchlist, heatmap… stack as many as you like. the agent can fill it too.</div>
            </div>
          </div>
        ) : drag ? (
          <div className="relative min-h-0 flex-1 overflow-hidden bg-[#08080a]">
            {panels.map((id, i) => (
              <Tile key={id} id={id} title={ALL_PANELS.find((p) => p.id === id)?.title ?? id} draggable pos={pos[id] ?? { x: 16 + (i % 4) * 44, y: 16 + (i % 5) * 30 }} onPos={(p) => setPos((m) => ({ ...m, [id]: p }))} onClose={() => onCloseTile(id)}>{render(id)}</Tile>
            ))}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto bg-[#08080a] p-2.5">
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gridAutoRows: "300px" }}>
              {panels.map((id) => (
                <Tile key={id} id={id} title={ALL_PANELS.find((p) => p.id === id)?.title ?? id} onClose={() => onCloseTile(id)}>{render(id)}</Tile>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// a dark panel tile — a static grid child, or an absolutely-positioned draggable card in drag mode
function Tile({ id, title, draggable, pos, onPos, onClose, children }: { id: string; title: string; draggable?: boolean; pos?: { x: number; y: number }; onPos?: (p: { x: number; y: number }) => void; onClose: () => void; children: React.ReactNode }) {
  void id;
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const onDown = (e: React.PointerEvent) => { if (!draggable || !pos) return; drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }; (e.currentTarget as Element).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { if (!drag.current) return; onPos?.({ x: Math.max(0, drag.current.ox + (e.clientX - drag.current.sx)), y: Math.max(0, drag.current.oy + (e.clientY - drag.current.sy)) }); };
  const onUp = (e: React.PointerEvent) => { drag.current = null; try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* */ } };
  return (
    <section
      style={draggable && pos ? { position: "absolute", left: pos.x, top: pos.y, width: 340, height: 300, minWidth: 240, minHeight: 180, resize: "both" } : undefined}
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-[#0b0b0d] shadow-lg">
      <header onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        className={`flex h-8 shrink-0 items-center justify-between border-b border-border px-3 ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}>
        <span className="select-none font-mono text-[0.64rem] uppercase tracking-[0.16em] text-muted-foreground">{draggable ? "⠿ " : ""}{title}</span>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} title="close" className="grid h-5 w-5 place-items-center rounded font-mono text-[0.9rem] leading-none text-muted-foreground/50 transition-colors hover:bg-[#ff5a5a]/15 hover:text-[#ff5a5a]">×</button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto bg-[#0b0b0d]">{children}</div>
    </section>
  );
}

// draw tools — pick one, then click the chart to place it (KLineChart interactive overlays)
const DRAW_TOOLS: { name: string; label: string; glyph: string }[] = [
  { name: "segment", label: "Trend line", glyph: "╱" },
  { name: "rayLine", label: "Ray", glyph: "↗" },
  { name: "horizontalStraightLine", label: "Horizontal", glyph: "─" },
  { name: "verticalStraightLine", label: "Vertical", glyph: "│" },
  { name: "priceLine", label: "Price level", glyph: "⊢" },
  { name: "rect", label: "Rectangle", glyph: "▭" },
  { name: "fibonacciLine", label: "Fibonacci", glyph: "≣" },
];
function DrawMenu({ onDraw }: { onDraw: (name: string) => void }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShow(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setShow((s) => !s)} title="draw on the chart" className={`grid h-6 w-7 place-items-center rounded-md border font-mono text-[0.82rem] leading-none transition-colors ${show ? "border-signal/40 text-signal" : "border-border text-muted-foreground hover:text-signal"}`}>✎</button>
      {show && (
        <div className="absolute right-0 top-full z-[60] mt-1.5 w-44 overflow-hidden rounded-xl border border-border bg-[#0d0d10] p-1 shadow-2xl">
          <div className="px-2.5 py-1 font-mono text-[0.5rem] uppercase tracking-widest text-muted-foreground/50">draw · then click chart</div>
          {DRAW_TOOLS.map((t) => (
            <button key={t.name} onClick={() => { onDraw(t.name); setShow(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[0.74rem] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground">
              <span className="w-4 text-center text-signal">{t.glyph}</span>{t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// "+" chart → search & pick which stock to open as a new chart
function AddChartButton({ disabled, onPick, quotes, openSymbols }: { disabled?: boolean; onPick: (s: string) => void; quotes: Record<string, { price: number; changePct: number }>; openSymbols: string[] }) {
  const [show, setShow] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setShow(false); setQ(""); } }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const results = useMemo(() => { const t = q.trim().toUpperCase(); return (t ? STOCKS.filter((s) => s.symbol.includes(t) || s.name.toUpperCase().includes(t)) : STOCKS).slice(0, 8); }, [q]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => !disabled && setShow((s) => !s)} disabled={disabled} title="add a chart" className="grid h-6 w-6 place-items-center rounded-md border border-border font-mono text-[0.8rem] leading-none text-muted-foreground transition-colors hover:border-signal/40 hover:text-signal disabled:opacity-30">＋</button>
      {show && (
        <div className="absolute right-0 top-full z-[60] mt-1.5 w-60 overflow-hidden rounded-xl border border-border bg-[#0d0d10] p-1 shadow-2xl">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="add a chart — ticker or company…" className="mb-1 w-full rounded-lg border border-border bg-[#0b0b0d] px-2.5 py-1.5 text-[0.76rem] outline-none placeholder:text-muted-foreground/50 focus:border-signal/40" />
          <div className="max-h-64 overflow-auto">
            {results.map((s) => { const on = openSymbols.includes(s.symbol); const qt = quotes[s.symbol]; return (
              <button key={s.symbol} onClick={() => { onPick(s.symbol); setShow(false); setQ(""); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]">
                <Logo s={s.symbol} size={18} /><span className="w-12 shrink-0 font-mono text-[0.76rem] text-foreground">{s.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-[0.72rem] text-muted-foreground">{s.name}</span>
                {on ? <span className="shrink-0 font-mono text-[0.5rem] uppercase tracking-widest text-signal/60">open</span> : qt && <span className={`shrink-0 font-mono text-[0.68rem] tabular-nums ${qt.changePct >= 0 ? "text-signal" : "text-[#ff5a5a]"}`}>{pct(qt.changePct)}</span>}
              </button>
            ); })}
          </div>
        </div>
      )}
    </div>
  );
}

// the watchlist as a full panel view — pick a symbol or unpin it
function WatchBody({ watch, quotes, onPick, onRemove }: { watch: string[]; quotes: Record<string, { price: number; changePct: number }>; onPick: (s: string) => void; onRemove: (s: string) => void }) {
  if (!watch.length) return <Empty>★ a market to pin it</Empty>;
  return (
    <table className="w-full border-collapse text-[0.8rem]">
      <tbody>
        {watch.map((sym) => { const q = quotes[sym]; return (
          <tr key={sym} onClick={() => onPick(sym)} className="cursor-pointer border-b border-border/40 hover:bg-white/[0.03]">
            <td className="py-2 pl-4 pr-2"><div className="flex items-center gap-2.5"><Logo s={sym} size={18} /><span className="font-mono">{sym}</span></div></td>
            <td className="py-2 pr-3 text-right font-mono tabular-nums text-foreground/90">{q ? fmt(q.price) : "—"}</td>
            <td className={`py-2 pr-3 text-right font-mono tabular-nums ${q ? (q.changePct >= 0 ? "text-signal" : "text-[#ff5a5a]") : "text-muted-foreground/40"}`}>{q ? pct(q.changePct) : "—"}</td>
            <td className="py-2 pr-4 text-right"><button onClick={(e) => { e.stopPropagation(); onRemove(sym); }} className="text-muted-foreground/40 hover:text-[#ff5a5a]">×</button></td>
          </tr>
        ); })}
      </tbody>
    </table>
  );
}

// ── wallet gate — the agent is gated to your wallet; connect first, then add a key ──
function WalletGate() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-signal/30 bg-signal/10">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-signal"><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" /><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" /><path d="M20 11v4h-4a2 2 0 0 1 0-4z" /></svg>
      </span>
      <div className="space-y-1.5">
        <h3 className="font-display text-lg tracking-tight text-foreground">Connect your wallet</h3>
        <p className="mx-auto max-w-[15rem] text-[0.82rem] leading-relaxed text-muted-foreground">The agent runs against your wallet — connect to unlock the chat. You&apos;ll sign every trade yourself.</p>
      </div>
      <ConnectButton.Custom>
        {({ openConnectModal, mounted }) => (
          <button onClick={openConnectModal} disabled={!mounted}
            className="rounded-lg border border-signal/50 bg-signal/15 px-6 py-2.5 font-mono text-[0.74rem] font-medium uppercase tracking-[0.14em] text-signal transition-colors hover:bg-signal/25">
            Connect wallet
          </button>
        )}
      </ConnectButton.Custom>
      <p className="font-mono text-[0.58rem] uppercase tracking-widest text-muted-foreground/40">then add a model key · or use free mode</p>
    </div>
  );
}


function TickerRibbon({ indices, quotes }: { indices: { label: string; changePct: number; price: number }[]; quotes: Record<string, { price: number; changePct: number }> }) {
  const stocks = ["NVDA", "AAPL", "TSLA", "MSFT", "META", "AMZN", "GOOGL", "AMD", "COIN", "SPY", "QQQ"].map((s) => ({ label: s, q: quotes[s] })).filter((x) => x.q);
  const items = [
    ...indices.map((m) => ({ label: m.label, price: m.price, ch: m.changePct })),
    ...stocks.map((x) => ({ label: x.label, price: x.q!.price, ch: x.q!.changePct })),
  ];
  if (!items.length) return <div className="px-4 font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground/40">loading markets…</div>;
  return (
    <div className="flex h-full items-center gap-5 overflow-x-auto px-4 font-mono text-[0.64rem] whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none]">
      {items.map((it, i) => (
        <span key={i} className="flex shrink-0 items-center gap-1.5">
          <span className="uppercase tracking-wide text-muted-foreground">{it.label}</span>
          <span className="tabular-nums text-foreground/75">{fmt(it.price)}</span>
          <span className={`tabular-nums ${it.ch >= 0 ? "text-signal" : "text-[#ff5a5a]"}`}>{it.ch >= 0 ? "+" : ""}{it.ch.toFixed(2)}%</span>
        </span>
      ))}
    </div>
  );
}

function MoversBody({ rows, onPick, up }: { rows: Mover[]; onPick: (s: string) => void; up?: boolean }) {
  if (rows.length === 0) return <Empty>loading…</Empty>;
  return (
    <table className="w-full border-collapse text-[0.74rem]">
      <tbody>
        {rows.slice(0, 12).map((m) => (
          <tr key={m.symbol} onClick={() => onPick(m.symbol)} className="cursor-pointer border-b border-border/40 hover:bg-white/[0.03]">
            <td className="py-1 pl-3 pr-2"><div className="flex items-center gap-1.5"><Logo s={m.symbol} size={14} /><span className="font-mono">{m.symbol}</span></div></td>
            <td className="py-1 pr-2 text-right font-mono tabular-nums text-foreground/80">{fmt(m.price)}</td>
            <td className={`py-1 pr-3 text-right font-mono tabular-nums ${up ? "text-signal" : "text-[#ff5a5a]"}`}>{pct(m.changePct)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// light markdown for agent messages — bullets, bold, clean line breaks
function renderMd(text: string): React.ReactNode {
  const bold = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, j) => (p.startsWith("**") && p.endsWith("**"))
    ? <strong key={j} className="font-semibold text-foreground">{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>);
  return text.split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-1.5" />;
    const isBullet = /^\s*[·•\-]\s+/.test(line);
    const body = bold(line.replace(/^\s*[·•\-]\s+/, ""));
    return isBullet
      ? <div key={i} className="flex gap-1.5"><span className="mt-px shrink-0 text-signal">›</span><span className="min-w-0">{body}</span></div>
      : <div key={i}>{body}</div>;
  });
}

// ── Horizon agent rail — a real chat that operates the terminal ──
function HorizonRail({ selected, messages, busy, status, onAsk, pendingTrade, taker, onClearTrade, onSettings, connected, agents, activeAgent, onSelectAgent, onNewAgent }: { selected: string; messages: HMsg[]; busy: boolean; status: string; onAsk: (t: string) => void; pendingTrade: ProposedTrade | null; taker: string | null; onClearTrade: () => void; onSettings: () => void; connected: boolean; agents: Agent[]; activeAgent: Agent | null; onSelectAgent: (id: string) => void; onNewAgent: () => void }) {
  const [input, setInput] = useState("");
  const [agentMenu, setAgentMenu] = useState(false);
  const agentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (agentRef.current && !agentRef.current.contains(e.target as Node)) setAgentMenu(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const [enabled, setEnabled] = useState<string[]>(ALL_SKILL_IDS);
  const [showSkills, setShowSkills] = useState(false);
  const [slashIdx, setSlashIdx] = useState(0);
  const [atIdx, setAtIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const examples = [
    `analyse ${selected} and draw the trend`,
    "mark support and resistance",
    "add a 50-day MA and RSI",
    `any news moving ${selected}?`,
  ];
  useEffect(() => { try { const raw = localStorage.getItem("urizen.skills.v1"); if (raw) { const ids = JSON.parse(raw); if (Array.isArray(ids)) setEnabled(ids.filter((id: string) => ALL_SKILL_IDS.includes(id))); } } catch { /* noop */ } }, []);
  const persistSkills = (ids: string[]) => { setEnabled(ids); try { localStorage.setItem("urizen.skills.v1", JSON.stringify(ids)); } catch { /* noop */ } };
  const toggleSkill = (id: string) => persistSkills(enabled.includes(id) ? enabled.filter((x) => x !== id) : [...enabled, id]);
  const slashItems = matchSlash(input);
  const atItems = slashItems.length ? [] : matchAt(input); // "@" mentions scope which data to consult
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, status]);
  const pickSkill = (s: { command: string }) => { setInput(s.command + " "); setSlashIdx(0); };
  const pickSource = (s: Source) => { setInput((prev) => prev.replace(/@\w*$/, s.command + " ")); setAtIdx(0); };
  const send = () => { const raw = input; setInput(""); setSlashIdx(0); setAtIdx(0); const r = resolveSlashCommand(raw); onAsk(r ? r.skill.prompt(r.arg) : raw); };

  return (
    <Pane n={3} title={activeAgent?.name || "Agent"} right={
      <div className="flex items-center gap-1.5">
        {/* persona selector — name or switch agents */}
        <div ref={agentRef} className="relative">
          <button onClick={() => setAgentMenu((v) => !v)} title="switch persona" className="flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-[0.58rem] uppercase tracking-wide text-muted-foreground transition-colors hover:border-signal/40 hover:text-signal">
            {activeAgent ? activeAgent.name : "＋ agent"} <span className="text-muted-foreground/50">▾</span>
          </button>
          {agentMenu && (
            <div className="absolute right-0 top-full z-[60] mt-1.5 w-52 overflow-hidden rounded-xl border border-border bg-[#0d0d10] p-1 shadow-2xl">
              <div className="px-2.5 py-1 font-mono text-[0.54rem] uppercase tracking-widest text-muted-foreground/50">persona</div>
              {agents.map((a) => (
                <button key={a.id} onClick={() => { onSelectAgent(a.id); setAgentMenu(false); }} className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[0.74rem] transition-colors ${a.id === activeAgent?.id ? "text-signal" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"}`}>
                  <span className="truncate">{a.name}</span><span className="shrink-0 font-mono text-[0.5rem] uppercase tracking-widest text-muted-foreground/50">{a.mandate}</span>
                </button>
              ))}
              <button onClick={() => { onNewAgent(); setAgentMenu(false); }} className={`mt-0.5 flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left font-mono text-[0.62rem] uppercase tracking-wide text-signal transition-colors hover:bg-signal/10 ${agents.length ? "border-t border-border" : ""}`}>＋ new agent</button>
              <Link href="/settings" className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left font-mono text-[0.6rem] uppercase tracking-wide text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground">settings ↗</Link>
            </div>
          )}
        </div>
        <button onClick={onSettings} title="Connect intelligence / API key" className="grid h-6 w-6 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-signal/50 hover:bg-signal/10 hover:text-signal">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        </button>
      </div>
    } bodyClass="flex flex-col">
      {!connected ? <WalletGate /> : <>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-signal/40 bg-signal/10"><UrizenMark className="h-3.5 w-auto text-signal" /></span>
              <div className="rounded-xl rounded-tl-sm border border-border bg-white/[0.03] p-3 text-[0.82rem] leading-relaxed text-foreground/90">
                {activeAgent
                  ? <>i&apos;m <span className="text-signal">{activeAgent.name}</span> — your {activeAgent.mandate.toLowerCase()} desk. tell me what to look at and i&apos;ll read the tape, draw on the chart, pull news, open panels, and set up trades for you to sign.</>
                  : <>i run this terminal. tell me what to look at — i&apos;ll read the tape, draw on the chart, pull news, open panels, and set up trades for you to sign.</>}
              </div>
            </div>
            {!activeAgent && (
              <button onClick={onNewAgent} className="flex w-full items-center gap-2.5 rounded-xl border border-signal/30 bg-signal/[0.05] p-3 text-left transition-colors hover:bg-signal/10">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-signal/30 bg-signal/10 text-signal">✦</span>
                <span className="min-w-0"><span className="block font-mono text-[0.68rem] uppercase tracking-widest text-signal">name your agent</span><span className="block text-[0.74rem] leading-snug text-muted-foreground">give it a persona, mandate &amp; risk — it shapes how it reads the tape.</span></span>
              </button>
            )}
            <InlineKeySetup onMore={onSettings} />
            <div className="space-y-1.5">
              <div className="font-mono text-[0.58rem] uppercase tracking-widest text-muted-foreground/60">try</div>
              {examples.map((e) => (
                <button key={e} onClick={() => onAsk(e)} className="block w-full truncate rounded-lg border border-border bg-white/[0.02] px-3 py-2 text-left text-[0.78rem] text-muted-foreground transition-colors hover:border-signal/40 hover:text-foreground">{e}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          const streaming = busy && isLast && m.role === "assistant";
          if (m.role === "user") return (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-tr-sm border border-signal/25 bg-signal/10 px-3 py-2 text-[0.82rem] leading-relaxed text-foreground">{m.content}</div>
            </div>
          );
          return (
            <div key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-signal/40 bg-signal/10"><UrizenMark className="h-3.5 w-auto text-signal" /></span>
              <div className="msg-in max-w-[88%] space-y-1.5 rounded-xl rounded-tl-sm border border-border bg-white/[0.03] px-3 py-2 text-[0.82rem] leading-relaxed text-foreground/90">
                {m.content && <div>{renderMd(m.content)}{streaming && !status && <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-signal align-middle" />}</div>}
                {streaming && status ? <Thinking status={status} /> : null}
                {!m.content && !status && streaming ? <Thinking status="thinking…" /> : null}
                {!m.content && !streaming ? <span className="text-muted-foreground/50">…</span> : null}
              </div>
            </div>
          );
        })}
      </div>
      {pendingTrade && (
        <div className="shrink-0 border-t border-border p-3 pb-0">
          <TradeTicket trade={pendingTrade} taker={taker} onClose={onClearTrade} />
        </div>
      )}
      <div className="relative shrink-0 border-t border-border p-3">
        {slashItems.length > 0 && <SlashMenu items={slashItems} active={slashIdx} onPick={pickSkill} title="Skills · / to run" />}
        {atItems.length > 0 && <SlashMenu items={atItems} active={atIdx} onPick={pickSource} title="Sources · @ to scope data" />}
        <div className="flex items-end gap-2 rounded-xl border border-border bg-[#0d0d10] p-1.5 focus-within:border-signal/40">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} disabled={busy}
            onKeyDown={(e) => {
              if (slashItems.length > 0) {
                if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx((i) => Math.min(i + 1, slashItems.length - 1)); return; }
                if (e.key === "ArrowUp") { e.preventDefault(); setSlashIdx((i) => Math.max(i - 1, 0)); return; }
                if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) { e.preventDefault(); pickSkill(slashItems[slashIdx]); return; }
                if (e.key === "Escape") { setInput(""); return; }
              }
              if (atItems.length > 0) {
                if (e.key === "ArrowDown") { e.preventDefault(); setAtIdx((i) => Math.min(i + 1, atItems.length - 1)); return; }
                if (e.key === "ArrowUp") { e.preventDefault(); setAtIdx((i) => Math.max(i - 1, 0)); return; }
                if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) { e.preventDefault(); pickSource(atItems[atIdx]); return; }
                if (e.key === "Escape") { setInput(""); return; }
              }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder={busy ? "working…" : `ask · / skills · @ sources`}
            className="max-h-24 min-h-[2rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-[0.82rem] outline-none placeholder:text-muted-foreground/50 disabled:opacity-50" />
          <button onClick={send} disabled={busy || !input.trim()} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-signal/15 text-signal transition-colors hover:bg-signal/25 disabled:opacity-40">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M3 11l18-8-8 18-2-7-8-3z" /></svg>
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <button onClick={() => setShowSkills(true)} className="flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-widest text-muted-foreground transition-colors hover:text-signal">
            ✦ Skills · {enabled.length}/{ALL_SKILL_IDS.length}
          </button>
          <span className="font-mono text-[0.55rem] uppercase tracking-widest text-muted-foreground/40">you sign every trade</span>
        </div>
      </div>
      {showSkills && <SkillsModal enabled={enabled} onToggle={toggleSkill} onSet={persistSkills} onClose={() => setShowSkills(false)} />}
      </>}
    </Pane>
  );
}

// ── symbol search — live autocomplete over the universe (keyboard-navigable) ──
function SymbolSearch({ onPick, quotes }: { onPick: (s: string) => void; quotes: Record<string, { price: number; changePct: number }> }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    const t = q.trim().toUpperCase();
    const base = t ? STOCKS.filter((s) => s.symbol.includes(t) || s.name.toUpperCase().includes(t)) : STOCKS;
    return base.slice(0, 8);
  }, [q]);
  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc); return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const choose = (sym: string) => { onPick(sym); setQ(""); setOpen(false); };
  return (
    <div ref={ref} className="relative w-full">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-[#0d0d10] px-3 py-1.5 focus-within:border-signal/40">
        <span className="text-muted-foreground/60">⌕</span>
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open || !results.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); choose(results[idx].symbol); }
            else if (e.key === "Escape") { setOpen(false); }
          }}
          placeholder="Search ticker or company…"
          className="w-full bg-transparent text-[0.82rem] outline-none placeholder:text-muted-foreground/50" />
        <kbd className="rounded border border-border px-1.5 font-mono text-[0.6rem] text-muted-foreground">/</kbd>
      </div>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-[#0d0d10] p-1 shadow-2xl">
          <div className="px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-muted-foreground/50">{q.trim() ? `${results.length} match${results.length === 1 ? "" : "es"}` : "markets"}</div>
          {results.length === 0 ? (
            <div className="px-2.5 py-3 text-center text-[0.76rem] text-muted-foreground/60">no match for “{q.trim()}”</div>
          ) : results.map((s, i) => { const qt = quotes[s.symbol]; return (
            <button key={s.symbol} onMouseEnter={() => setIdx(i)} onClick={() => choose(s.symbol)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors ${i === idx ? "bg-signal/10" : "hover:bg-white/[0.04]"}`}>
              <Logo s={s.symbol} size={20} />
              <span className="w-14 shrink-0 font-mono text-[0.8rem] text-foreground">{s.symbol}</span>
              <span className="min-w-0 flex-1 truncate text-[0.75rem] text-muted-foreground">{s.name}</span>
              {qt && <span className="font-mono text-[0.72rem] tabular-nums text-foreground/70">{fmt(qt.price)}</span>}
              {qt && <span className={`w-16 shrink-0 text-right font-mono text-[0.7rem] tabular-nums ${qt.changePct >= 0 ? "text-signal" : "text-[#ff5a5a]"}`}>{pct(qt.changePct)}</span>}
            </button>
          ); })}
        </div>
      )}
    </div>
  );
}

// ── a clean custom connect button (no default RainbowKit chrome) ──
function ConnectWalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
        const connected = mounted && !!account && !!chain;
        if (!connected)
          return <button onClick={openConnectModal} className="rounded-md border border-signal/50 bg-signal/10 px-4 py-1.5 font-mono text-[0.72rem] font-medium uppercase tracking-[0.12em] text-signal transition-colors hover:bg-signal/20">Connect</button>;
        if (chain.unsupported)
          return <button onClick={openChainModal} className="rounded-md border border-[#ff5a5a]/50 bg-[#ff5a5a]/10 px-4 py-1.5 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-[#ff5a5a] transition-colors hover:bg-[#ff5a5a]/20">Wrong network</button>;
        return (
          <button onClick={openAccountModal} className="flex items-center gap-2 rounded-md border border-border bg-white/[0.03] px-3 py-1.5 font-mono text-[0.72rem] text-foreground transition-colors hover:border-signal/40">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />{account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
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
