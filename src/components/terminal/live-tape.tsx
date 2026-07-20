"use client";

// The live tape — an always-scrolling, always-flashing ticker that runs across the whole desk.
// Every cell is a real 24/7 on-chain quote; when a price ticks between polls the cell flashes
// green (up) or red (down), the way a real trading floor's tape blinks. This is the terminal's
// heartbeat: it never stops, because the on-chain market never closes.

import { useEffect, useMemo, useRef, useState } from "react";
import { STOCKS } from "@/lib/stocks";

type Quote = { price: number; changePct: number };
type Idx = { label: string; price: number; changePct: number };

const fmtPrice = (n: number) =>
  n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : n >= 1 ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

type Cell = { key: string; label: string; price: number; changePct: number };

function Cells({ cells, flash }: { cells: Cell[]; flash: Record<string, "up" | "down"> }) {
  return (
    <>
      {cells.map((c) => {
        const up = c.changePct >= 0;
        const fl = flash[c.key];
        return (
          <span
            key={c.key}
            className={`inline-flex shrink-0 items-baseline gap-1.5 border-r border-border/40 px-3.5 py-1 ${fl === "up" ? "tape-flash-up" : fl === "down" ? "tape-flash-down" : ""}`}
          >
            <span className="font-mono text-[0.7rem] font-semibold tracking-wide text-foreground/90">{c.label}</span>
            <span className="font-mono text-[0.7rem] tabular-nums text-foreground/70">{fmtPrice(c.price)}</span>
            <span className={`font-mono text-[0.66rem] tabular-nums ${up ? "text-signal" : "text-[#ff5a5a]"}`}>
              {up ? "▲" : "▼"}{fmtPct(c.changePct).replace("-", "")}
            </span>
          </span>
        );
      })}
    </>
  );
}

export function LiveTape({ quotes, indices }: { quotes: Record<string, Quote>; indices: Idx[] }) {
  const cells = useMemo<Cell[]>(() => {
    const idx: Cell[] = (indices || []).map((i) => ({ key: `idx:${i.label}`, label: i.label.toUpperCase(), price: i.price, changePct: i.changePct }));
    const stk: Cell[] = STOCKS
      .map((s) => ({ s, q: quotes[s.symbol] }))
      .filter((x) => x.q)
      .map(({ s, q }) => ({ key: `stk:${s.symbol}`, label: s.symbol, price: q.price, changePct: q.changePct }));
    return [...idx, ...stk];
  }, [quotes, indices]);

  // flash a cell when its price moves between polls
  const prev = useRef<Record<string, number>>({});
  const [flash, setFlash] = useState<Record<string, "up" | "down">>({});
  useEffect(() => {
    const next: Record<string, "up" | "down"> = {};
    for (const c of cells) {
      const p = prev.current[c.key];
      if (p != null && p !== c.price) next[c.key] = c.price > p ? "up" : "down";
      prev.current[c.key] = c.price;
    }
    if (Object.keys(next).length) {
      setFlash(next);
      const t = setTimeout(() => setFlash({}), 900);
      return () => clearTimeout(t);
    }
  }, [cells]);

  if (!cells.length) {
    return (
      <div className="flex h-full items-center px-3">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">Connecting to the on-chain tape…</span>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden">
      {/* the scrolling tape — content duplicated for a seamless loop */}
      <div className="tape-track flex h-full w-max items-stretch">
        <Cells cells={cells} flash={flash} />
        <Cells cells={cells} flash={flash} />
      </div>
      {/* edge fades so cells melt in/out at the rails */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#0a0a0b] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#0a0a0b] to-transparent" />
    </div>
  );
}
