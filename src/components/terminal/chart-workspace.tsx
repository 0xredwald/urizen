"use client";

import { useEffect, useState } from "react";
import { KlineChart, type ChartHandle } from "@/components/terminal/kline-chart";

// The chart playground — up to 4 independent, focusable charts in a grid. Each fetches its own data;
// the agent opens new ones (openChart) and draws on whichever is focused (the active panel glows).

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const flogo = (s: string) => `https://financialmodelingprep.com/image-stock/${s}.png`;

function ChartPanel({ id, symbol, interval, active, closable, onFocus, onClose, onHandle }: {
  id: string; symbol: string; interval: string; active: boolean; closable: boolean;
  onFocus: () => void; onClose: () => void; onHandle: (id: string, h: ChartHandle | null) => void;
}) {
  const [head, setHead] = useState<{ price: number; prevClose: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let on = true;
    // light fetch just for the mini-header price/change; the chart self-loads its own full series
    const load = () => fetch(`/api/quant/ohlc?symbol=${encodeURIComponent(symbol)}&interval=${interval}`).then((r) => r.json()).then((d) => {
      if (!on) return; setLoaded(true); setHead(d?.price != null && d?.prevClose != null ? { price: d.price, prevClose: d.prevClose } : null);
    }).catch(() => { if (on) setLoaded(true); });
    load(); const t = setInterval(load, 20000);
    return () => { on = false; clearInterval(t); };
  }, [symbol, interval]);
  const ch = head ? (head.price / head.prevClose - 1) * 100 : 0; const up = ch >= 0;
  return (
    <div onMouseDown={onFocus} className={`relative flex min-h-0 flex-col overflow-hidden rounded-md border transition-colors ${active ? "border-signal/50 shadow-[0_0_0_1px_rgba(52,240,3,0.15)]" : "border-border hover:border-white/20"}`}>
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={flogo(symbol)} alt="" className="h-4 w-4 rounded-full bg-white object-contain" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
        <span className="font-mono text-[0.72rem] text-foreground">{symbol}</span>
        {head && <span className="font-mono text-[0.68rem] tabular-nums text-muted-foreground">${fmt(head.price)}</span>}
        {head && <span className={`font-mono text-[0.66rem] tabular-nums ${up ? "text-signal" : "text-[#ff5a5a]"}`}>{up ? "+" : ""}{ch.toFixed(2)}%</span>}
        {active && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-signal" title="Horizon draws here" />}
        <span className="ml-auto" />
        {closable && <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="px-1 text-muted-foreground/50 hover:text-[#ff5a5a]">×</button>}
      </div>
      <div className="min-h-0 flex-1">
        <KlineChart ref={(h) => onHandle(id, h)} symbol={symbol} interval={interval} />
        {!loaded && <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground/40">loading…</div>}
      </div>
    </div>
  );
}

export function ChartWorkspace({ charts, activeId, interval, onFocus, onClose, onHandle }: {
  charts: { id: string; symbol: string }[]; activeId: string; interval: string;
  onFocus: (id: string) => void; onClose: (id: string) => void; onHandle: (id: string, h: ChartHandle | null) => void;
}) {
  const n = charts.length;
  const cols = n <= 1 ? 1 : 2;
  const rows = n <= 2 ? 1 : 2;
  return (
    <div className="grid h-full gap-2 p-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0,1fr))` }}>
      {charts.map((c) => (
        <ChartPanel key={c.id} id={c.id} symbol={c.symbol} interval={interval} active={c.id === activeId} closable={n > 1}
          onFocus={() => onFocus(c.id)} onClose={() => onClose(c.id)} onHandle={onHandle} />
      ))}
    </div>
  );
}
