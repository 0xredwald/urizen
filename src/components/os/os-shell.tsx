"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChartWorkspace } from "@/components/terminal/chart-workspace";
import { PerpsPanel } from "@/components/terminal/perps-panel";
import { SwapTicket } from "@/components/terminal/swap-ticket";
import { Portfolio, usePortfolio } from "@/components/terminal/portfolio";
import { UrizenMark } from "@/components/brand/marks";
import { STOCKS } from "@/lib/stocks";
import { runHorizon, type HMsg } from "@/lib/horizon";

// ── URIZEN OS ─────────────────────────────────────────────────────────────────
// A desktop-style windowing shell over the real terminal surfaces. Draggable, resizable, focusable,
// minimizable windows; a dock to launch/restore apps; a menu bar with a live clock + wallet. Each app
// is a real, wired surface (chart, perps trading, swap, portfolio, markets, the agent).

type AppId = "chart" | "perps" | "swap" | "portfolio" | "markets" | "agent";
type Win = { id: string; app: AppId; x: number; y: number; w: number; h: number; z: number; min: boolean };

const APP_META: Record<AppId, { title: string; glyph: string; w: number; h: number }> = {
  chart: { title: "Charts", glyph: "📈", w: 720, h: 460 },
  perps: { title: "Perps · Lighter", glyph: "⚡", w: 340, h: 560 },
  swap: { title: "Swap", glyph: "🔁", w: 360, h: 420 },
  portfolio: { title: "Portfolio", glyph: "◆", w: 380, h: 380 },
  markets: { title: "Markets", glyph: "▦", w: 360, h: 480 },
  agent: { title: "Urizen Agent", glyph: "◑", w: 420, h: 520 },
};
const DOCK: AppId[] = ["chart", "perps", "swap", "markets", "portfolio", "agent"];

let ZTOP = 10;

export function OsShell() {
  const [wins, setWins] = useState<Win[]>([]);
  const idRef = useRef(0);
  const deskRef = useRef<HTMLDivElement>(null);

  // restore any saved layout
  useEffect(() => {
    try { const s = localStorage.getItem("urizen.os.wins"); if (s) { const w = JSON.parse(s); if (Array.isArray(w) && w.length) { setWins(w); ZTOP = Math.max(ZTOP, ...w.map((x: Win) => x.z)) + 1; return; } } } catch { /* */ }
    // first run — open a clean default pair; launch the rest from the dock
    open("chart", 40, 56); open("agent", 792, 56);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem("urizen.os.wins", JSON.stringify(wins)); } catch { /* */ } }, [wins]);

  function open(app: AppId, x?: number, y?: number) {
    setWins((ws) => {
      const existing = ws.find((w) => w.app === app);
      if (existing) return ws.map((w) => w.app === app ? { ...w, min: false, z: ++ZTOP } : w);
      const m = APP_META[app];
      const n = ws.length;
      const id = `w${++idRef.current}`;
      return [...ws, { id, app, x: x ?? 60 + n * 34, y: y ?? 64 + n * 30, w: m.w, h: m.h, z: ++ZTOP, min: false }];
    });
  }
  const focus = useCallback((id: string) => setWins((ws) => ws.map((w) => w.id === id ? { ...w, z: ++ZTOP } : w)), []);
  const close = (id: string) => setWins((ws) => ws.filter((w) => w.id !== id));
  const minimize = (id: string) => setWins((ws) => ws.map((w) => w.id === id ? { ...w, min: true } : w));
  const move = (id: string, x: number, y: number) => setWins((ws) => ws.map((w) => w.id === id ? { ...w, x, y } : w));
  const resize = (id: string, w: number, h: number) => setWins((ws) => ws.map((wn) => wn.id === id ? { ...wn, w, h } : wn));

  const openApps = new Set(wins.filter((w) => !w.min).map((w) => w.app));

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#08080a] text-foreground select-none">
      {/* wallpaper — Blake, veiled */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/blake-ancient.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_18%] opacity-[0.16] grayscale contrast-[1.15]" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% 15%, rgba(52,240,3,0.06), transparent 70%), linear-gradient(180deg, rgba(8,8,10,0.5), rgba(8,8,10,0.72))" }} />
      </div>

      {/* menu bar */}
      <header className="relative z-[9999] flex h-8 items-center gap-3 border-b border-border bg-[#0a0a0b]/80 px-3 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-1.5"><UrizenMark className="h-3.5 w-auto text-signal" /><span className="font-display text-[12px] font-bold tracking-tight">URIZEN OS</span></Link>
        <span className="hidden font-mono text-[0.56rem] uppercase tracking-widest text-muted-foreground/60 sm:inline">{wins.filter((w) => !w.min).length} open</span>
        <Link href="/terminal" className="ml-2 font-mono text-[0.56rem] uppercase tracking-widest text-muted-foreground/60 transition-colors hover:text-signal">terminal ↗</Link>
        <div className="ml-auto flex items-center gap-3">
          <Clock />
          <div className="scale-90"><ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" /></div>
        </div>
      </header>

      {/* desktop */}
      <div ref={deskRef} className="absolute inset-x-0 bottom-14 top-8">
        {wins.filter((w) => !w.min).map((w) => (
          <Window key={w.id} win={w} onFocus={focus} onClose={close} onMinimize={minimize} onMove={move} onResize={resize} bounds={deskRef} />
        ))}
      </div>

      {/* dock */}
      <footer className="absolute inset-x-0 bottom-0 z-[9999] flex h-14 items-end justify-center pb-2">
        <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-[#0b0b0d]/85 px-2.5 py-1.5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          {DOCK.map((app) => {
            const active = openApps.has(app);
            return (
              <button key={app} onClick={() => open(app)} title={APP_META[app].title}
                className={`group relative grid h-9 w-9 place-items-center rounded-xl text-[1.05rem] transition-all hover:-translate-y-1 hover:bg-white/[0.06] ${active ? "bg-signal/10" : ""}`}>
                <span>{APP_META[app].glyph}</span>
                <span className={`absolute -bottom-1 h-1 w-1 rounded-full transition-opacity ${active ? "bg-signal opacity-100" : "opacity-0"}`} />
              </button>
            );
          })}
        </div>
      </footer>
    </main>
  );
}

// ── a window ────────────────────────────────────────────────────────────────
function Window({ win, onFocus, onClose, onMinimize, onMove, onResize, bounds }:
  { win: Win; onFocus: (id: string) => void; onClose: (id: string) => void; onMinimize: (id: string) => void; onMove: (id: string, x: number, y: number) => void; onResize: (id: string, w: number, h: number) => void; bounds: React.RefObject<HTMLDivElement | null> }) {
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const rz = useRef<{ sx: number; sy: number; ow: number; oh: number } | null>(null);
  const m = APP_META[win.app];

  const onHeadDown = (e: React.PointerEvent) => { onFocus(win.id); drag.current = { sx: e.clientX, sy: e.clientY, ox: win.x, oy: win.y }; (e.currentTarget as Element).setPointerCapture(e.pointerId); };
  const onHeadMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const b = bounds.current?.getBoundingClientRect();
    const maxX = (b?.width ?? 2000) - 80, maxY = (b?.height ?? 1000) - 40;
    onMove(win.id, Math.max(0, Math.min(maxX, drag.current.ox + (e.clientX - drag.current.sx))), Math.max(0, Math.min(maxY, drag.current.oy + (e.clientY - drag.current.sy))));
  };
  const onHeadUp = (e: React.PointerEvent) => { drag.current = null; try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* */ } };

  const onRzDown = (e: React.PointerEvent) => { e.stopPropagation(); onFocus(win.id); rz.current = { sx: e.clientX, sy: e.clientY, ow: win.w, oh: win.h }; (e.currentTarget as Element).setPointerCapture(e.pointerId); };
  const onRzMove = (e: React.PointerEvent) => { if (!rz.current) return; onResize(win.id, Math.max(280, rz.current.ow + (e.clientX - rz.current.sx)), Math.max(200, rz.current.oh + (e.clientY - rz.current.sy))); };
  const onRzUp = (e: React.PointerEvent) => { rz.current = null; try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* */ } };

  return (
    <section
      onPointerDown={() => onFocus(win.id)}
      style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
      className="absolute flex flex-col overflow-hidden rounded-xl border border-border bg-[#0b0b0d]/92 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl">
      <header onPointerDown={onHeadDown} onPointerMove={onHeadMove} onPointerUp={onHeadUp}
        className="flex h-8 shrink-0 cursor-grab items-center gap-2 border-b border-border bg-[#0a0a0b]/80 px-2.5 active:cursor-grabbing">
        <div className="flex items-center gap-1.5">
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => onClose(win.id)} title="close" className="h-2.5 w-2.5 rounded-full bg-[#ff5a5a]/80 transition-colors hover:bg-[#ff5a5a]" />
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => onMinimize(win.id)} title="minimize" className="h-2.5 w-2.5 rounded-full bg-[#f5b83d]/80 transition-colors hover:bg-[#f5b83d]" />
          <span className="h-2.5 w-2.5 rounded-full bg-signal/50" />
        </div>
        <span className="ml-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">{m.glyph} {m.title}</span>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <AppBody app={win.app} />
      </div>
      {/* resize handle */}
      <div onPointerDown={onRzDown} onPointerMove={onRzMove} onPointerUp={onRzUp}
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none" style={{ background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.18) 50%)" }} />
    </section>
  );
}

// ── app bodies ──────────────────────────────────────────────────────────────
function AppBody({ app }: { app: AppId }) {
  if (app === "chart") return <ChartApp />;
  if (app === "perps") return <div className="h-full overflow-auto"><PerpsPanel /></div>;
  if (app === "swap") return <div className="h-full overflow-auto p-2"><SwapTicket defaultBuy="NVDA" /></div>;
  if (app === "portfolio") return <PortfolioApp />;
  if (app === "markets") return <MarketsApp />;
  if (app === "agent") return <AgentApp />;
  return null;
}

function ChartApp() {
  return (
    <ChartWorkspace charts={[{ id: "os-c1", symbol: "NVDA" }]} activeId="os-c1" interval="15m"
      onFocus={() => {}} onClose={() => {}} onHandle={() => {}} />
  );
}

function PortfolioApp() {
  const { holdings, total, loading, connected } = usePortfolio({});
  return <div className="h-full overflow-auto"><Portfolio holdings={holdings} total={total} loading={loading} connected={connected} onPick={() => {}} /></div>;
}

type Mover = { symbol: string; name: string; price: number; changePct: number };
function MarketsApp() {
  const [rows, setRows] = useState<Mover[]>([]);
  useEffect(() => {
    let on = true;
    const load = () => fetch("/api/quant/movers").then((r) => r.json()).then((d) => {
      if (!on) return;
      const all: Mover[] = Array.isArray(d?.all) && d.all.length ? d.all : [...(d?.gainers || []), ...(d?.losers || [])];
      setRows(all);
    }).catch(() => {});
    load(); const t = setInterval(load, 15000);
    return () => { on = false; clearInterval(t); };
  }, []);
  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-[0.78rem]">
        <tbody>
          {rows.map((s) => (
            <tr key={s.symbol} className="border-b border-border/40">
              <td className="py-1.5 pl-3 font-mono text-foreground">{s.symbol}</td>
              <td className="py-1.5 pr-2 text-right font-mono tabular-nums text-foreground/90">{s.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className={`py-1.5 pr-3 text-right font-mono tabular-nums ${s.changePct >= 0 ? "text-signal" : "text-[#ff5a5a]"}`}>{s.changePct >= 0 ? "+" : ""}{s.changePct?.toFixed(2)}%</td>
            </tr>
          ))}
          {!rows.length && <tr><td className="p-4 text-center font-mono text-[0.66rem] uppercase tracking-widest text-muted-foreground/40">loading…</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AgentApp() {
  const [msgs, setMsgs] = useState<HMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const t = input.trim(); if (!t || busy) return;
    setInput(""); setMsgs((m) => [...m, { role: "user", content: t }, { role: "assistant", content: "" }]);
    setBusy(true);
    const patch = (c: string) => setMsgs((m) => { const a = [...m]; for (let i = a.length - 1; i >= 0; i--) if (a[i].role === "assistant") { a[i] = { ...a[i], content: c }; break; } return a; });
    try {
      const r = await runHorizon(t, { symbol: "NVDA", range: "15m", candles: [], universe: STOCKS.map((s) => s.symbol) }, [...msgs, { role: "user", content: t }], { onText: (v) => v && patch(v) });
      patch(r.say || "…");
    } catch (e) { patch(`hit a snag — ${(e as Error)?.message || "try again"}`); } finally { setBusy(false); }
  };
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        {msgs.length === 0 && <div className="grid h-full place-items-center px-4 text-center font-mono text-[0.66rem] uppercase tracking-widest text-muted-foreground/40">i&apos;m urizen — ask me anything</div>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[0.82rem] leading-relaxed ${m.role === "user" ? "bg-signal/15 text-foreground" : "bg-white/[0.04] text-foreground/90"}`}>{m.content || (busy ? "…" : "")}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-border p-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="ask the agent…"
          className="min-w-0 flex-1 rounded-md border border-border bg-[#0a0a0b] px-2.5 py-1.5 text-[0.82rem] outline-none placeholder:text-muted-foreground/40 focus:border-signal/40" />
        <button onClick={send} disabled={busy} className="rounded-md border border-signal/40 bg-signal/15 px-3 py-1.5 font-mono text-[0.66rem] uppercase tracking-widest text-signal transition-colors hover:bg-signal/25 disabled:opacity-40">send</button>
      </div>
    </div>
  );
}

function Clock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => setT(new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/New_York" }).format(new Date()) + " ET");
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-[0.6rem] tabular-nums text-muted-foreground">{t}</span>;
}
