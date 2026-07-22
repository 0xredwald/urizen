"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PerpTicket } from "@/components/terminal/perp-ticket";

// Lighter perpetuals — a live central-limit order book (crypto/index perps) as a derivatives
// market-context panel. Polls our server proxy every ~3s and renders a real depth ladder with
// cumulative size bars, best bid/ask, mid and spread. Not the RH equity tokens (those trade on an
// AMM with no order book) — this is the honest "order book" the desk can actually show.

const MARKETS = [
  { sym: "BTC", id: 1, pdp: 1 },
  { sym: "ETH", id: 0, pdp: 2 },
  { sym: "SOL", id: 2, pdp: 3 },
];
type Level = { price: number; size: number; cum: number };
type Book = { bids: Level[]; asks: Level[]; bestBid: number | null; bestAsk: number | null; mid: number | null; spreadBps: number | null; mark: number | null; index: number | null; basisBps: number | null; change24h: number | null; oi: number | null };

const fmtP = (n: number, dp: number) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const fmtS = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });
const compact = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n.toFixed(1)}`;

export function PerpsPanel() {
  const [market, setMarket] = useState(MARKETS[0]);
  const [book, setBook] = useState<Book | null>(null);
  const [err, setErr] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let on = true;
    const load = () => fetch(`/api/perps/lighter?market_id=${market.id}`).then((r) => r.json()).then((d) => {
      if (!on) return;
      if (d?.error && !(d.bids?.length)) { setErr(true); return; }
      setErr(false); setBook(d);
    }).catch(() => { if (on) setErr(true); });
    load();
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(load, 3000);
    return () => { on = false; if (timer.current) clearInterval(timer.current); };
  }, [market]);

  const maxCum = useMemo(() => {
    if (!book) return 1;
    const a = book.asks[book.asks.length - 1]?.cum ?? 0;
    const b = book.bids[book.bids.length - 1]?.cum ?? 0;
    return Math.max(a, b, 1);
  }, [book]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="font-mono text-[0.54rem] uppercase tracking-widest text-muted-foreground/60">Lighter perps</span>
        <div className="ml-auto flex items-center gap-0.5 rounded-md border border-border p-0.5">
          {MARKETS.map((m) => (
            <button key={m.sym} onClick={() => setMarket(m)} className={`rounded px-1.5 py-0.5 font-mono text-[0.6rem] transition-colors ${m.sym === market.sym ? "bg-signal/15 text-signal" : "text-muted-foreground hover:text-foreground"}`}>{m.sym}</button>
          ))}
        </div>
      </div>
      {/* funding / basis readout — mark vs index is the perp premium that drives funding */}
      {book && (book.mark != null || book.basisBps != null) && (
        <div className="grid grid-cols-4 gap-px border-b border-border bg-border/40 text-center">
          {[
            { k: "Mark", v: book.mark != null ? fmtP(book.mark, market.pdp) : "—", tone: "text-foreground" },
            { k: "Index", v: book.index != null ? fmtP(book.index, market.pdp) : "—", tone: "text-muted-foreground" },
            { k: "Basis", v: book.basisBps != null ? `${book.basisBps >= 0 ? "+" : ""}${book.basisBps.toFixed(1)}bp` : "—", tone: book.basisBps == null ? "text-muted-foreground" : book.basisBps >= 0 ? "text-signal" : "text-[#ff5a5a]" },
            { k: "OI", v: book.oi != null ? compact(book.oi) : "—", tone: "text-muted-foreground" },
          ].map((c) => (
            <div key={c.k} className="bg-[#0b0b0d] px-1.5 py-1.5">
              <div className="font-mono text-[0.5rem] uppercase tracking-widest text-muted-foreground/60">{c.k}</div>
              <div className={`mt-0.5 font-mono text-[0.72rem] tabular-nums ${c.tone}`}>{c.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* the trade ticket — long/short, leverage, market/limit, live preview off the mark */}
      <PerpTicket symbol={market.sym} mark={book?.mark ?? book?.mid ?? null} priceDp={market.pdp}
        connected={false} onConnect={() => window.open("https://app.lighter.xyz", "_blank", "noopener")} />

      {err ? (
        <div className="grid flex-1 place-items-center px-4 text-center font-mono text-[0.66rem] uppercase tracking-widest text-muted-foreground/50">order book unavailable</div>
      ) : !book ? (
        <div className="grid flex-1 place-items-center font-mono text-[0.66rem] uppercase tracking-widest text-muted-foreground/40">loading book…</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* asks — best ask nearest the mid (render ascending, bottom-anchored) */}
          <div className="flex min-h-0 flex-1 flex-col-reverse justify-start overflow-hidden">
            {book.asks.map((l) => (
              <Row key={`a${l.price}`} l={l} dp={market.pdp} max={maxCum} side="ask" />
            ))}
          </div>
          {/* mid + spread */}
          <div className="flex items-baseline justify-between border-y border-border/60 bg-white/[0.02] px-3 py-1.5">
            <span className="font-mono text-[0.85rem] tabular-nums text-foreground">{book.mid != null ? fmtP(book.mid, market.pdp) : "—"}</span>
            <span className="font-mono text-[0.6rem] tabular-nums text-muted-foreground">{book.spreadBps != null ? `${book.spreadBps.toFixed(1)} bps` : "—"}</span>
          </div>
          {/* bids */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {book.bids.map((l) => (
              <Row key={`b${l.price}`} l={l} dp={market.pdp} max={maxCum} side="bid" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ l, dp, max, side }: { l: Level; dp: number; max: number; side: "bid" | "ask" }) {
  const ask = side === "ask";
  return (
    <div className="relative flex items-center justify-between px-3 py-0.5 font-mono text-[0.68rem] tabular-nums">
      <span className={`absolute inset-y-0 right-0 ${ask ? "bg-[#ff5a5a]/10" : "bg-signal/10"}`} style={{ width: `${(l.cum / max) * 100}%` }} />
      <span className={`relative ${ask ? "text-[#ff5a5a]" : "text-signal"}`}>{fmtP(l.price, dp)}</span>
      <span className="relative text-muted-foreground/80">{fmtS(l.size)}</span>
    </div>
  );
}
