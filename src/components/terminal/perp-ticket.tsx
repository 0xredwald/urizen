"use client";

import { useMemo, useState } from "react";

// Perpetual trade ticket — Lighter perps. Long/short, market or limit, leverage, with a live order
// preview (position size, notional, initial margin, est. liquidation, taker fee). Order submission on
// Lighter requires a Lighter account index + API key and their zk-signer (client-side signing), so the
// "Place" action is gated on connecting a Lighter account — we never custody keys and you sign every
// order yourself. Until connected we still fully price the order off the live mark.
//
// Isolated-margin estimates (maintenance-margin ignored for the simple preview):
//   long  liq ≈ entry · (1 − 1/leverage) · (1 + takerFee)
//   short liq ≈ entry · (1 + 1/leverage) · (1 − takerFee)

const TAKER_FEE = 0.0004; // 0.04% taker (indicative; Lighter fees vary by tier)
const LEVERAGES = [1, 2, 3, 5, 10, 20];

export function PerpTicket({ symbol, mark, priceDp, connected, onConnect }:
  { symbol: string; mark: number | null; priceDp: number; connected?: boolean; onConnect?: () => void }) {
  const [side, setSide] = useState<"long" | "short">("long");
  const [type, setType] = useState<"market" | "limit">("market");
  const [lev, setLev] = useState(3);
  const [usd, setUsd] = useState("");
  const [limit, setLimit] = useState("");

  const entry = type === "limit" ? (Number(limit) || mark || 0) : (mark || 0);
  const notional = Number(usd) || 0;

  const preview = useMemo(() => {
    if (!entry || !notional) return null;
    const base = notional / entry;
    const margin = notional / lev;
    const fee = notional * TAKER_FEE;
    const liq = side === "long"
      ? entry * (1 - 1 / lev) * (1 + TAKER_FEE)
      : entry * (1 + 1 / lev) * (1 - TAKER_FEE);
    return { base, margin, fee, liq };
  }, [entry, notional, lev, side]);

  const fmt = (n: number, d = priceDp) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  const valid = !!preview && notional > 0 && (type === "market" || Number(limit) > 0);
  const isLong = side === "long";

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-[#0b0b0d] px-3 py-2.5">
      {/* long / short */}
      <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-0.5">
        {(["long", "short"] as const).map((s) => (
          <button key={s} onClick={() => setSide(s)}
            className={`rounded py-1 font-mono text-[0.66rem] uppercase tracking-widest transition-colors ${side === s ? (s === "long" ? "bg-signal/20 text-signal" : "bg-[#ff5a5a]/20 text-[#ff5a5a]") : "text-muted-foreground hover:text-foreground"}`}>
            {s}
          </button>
        ))}
      </div>

      {/* market / limit */}
      <div className="flex items-center gap-1">
        {(["market", "limit"] as const).map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={`rounded px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-widest transition-colors ${type === t ? "bg-white/10 text-foreground" : "text-muted-foreground/70 hover:text-foreground"}`}>
            {t}
          </button>
        ))}
        <span className="ml-auto font-mono text-[0.58rem] tabular-nums text-muted-foreground">mark {mark != null ? fmt(mark) : "—"}</span>
      </div>

      {type === "limit" && (
        <label className="flex items-center gap-2 rounded-md border border-border bg-[#0a0a0b] px-2 py-1.5">
          <span className="font-mono text-[0.54rem] uppercase tracking-widest text-muted-foreground/60">Limit</span>
          <input value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d.]/g, ""))} placeholder={mark != null ? fmt(mark) : "0.00"}
            className="w-full bg-transparent text-right font-mono text-[0.8rem] tabular-nums outline-none placeholder:text-muted-foreground/40" inputMode="decimal" />
        </label>
      )}

      {/* size (USD notional) */}
      <label className="flex items-center gap-2 rounded-md border border-border bg-[#0a0a0b] px-2 py-1.5">
        <span className="font-mono text-[0.54rem] uppercase tracking-widest text-muted-foreground/60">Size $</span>
        <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00"
          className="w-full bg-transparent text-right font-mono text-[0.9rem] tabular-nums outline-none placeholder:text-muted-foreground/40" inputMode="decimal" />
      </label>

      {/* leverage */}
      <div className="flex items-center gap-1">
        {LEVERAGES.map((l) => (
          <button key={l} onClick={() => setLev(l)}
            className={`flex-1 rounded py-0.5 font-mono text-[0.6rem] tabular-nums transition-colors ${lev === l ? "bg-signal/15 text-signal" : "text-muted-foreground hover:text-foreground"}`}>
            {l}×
          </button>
        ))}
      </div>

      {/* order preview */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[0.62rem] tabular-nums">
        <Row k="Size" v={preview ? `${preview.base.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}` : "—"} />
        <Row k="Margin" v={preview ? `$${preview.margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"} />
        <Row k="Est. liq." v={preview ? `$${fmt(preview.liq)}` : "—"} tone={isLong ? "text-[#ff5a5a]" : "text-[#ff5a5a]"} />
        <Row k="Taker fee" v={preview ? `$${preview.fee.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"} />
      </div>

      <button
        disabled={!valid}
        onClick={() => { if (!connected) onConnect?.(); }}
        className={`mt-0.5 rounded-md py-2 font-mono text-[0.68rem] uppercase tracking-widest transition-colors disabled:opacity-30 ${isLong ? "bg-signal/15 text-signal hover:bg-signal/25" : "bg-[#ff5a5a]/15 text-[#ff5a5a] hover:bg-[#ff5a5a]/25"}`}>
        {connected ? `${side === "long" ? "Buy / Long" : "Sell / Short"} ${symbol}` : "Connect Lighter to trade"}
      </button>
      {!connected && (
        <p className="text-center font-mono text-[0.52rem] leading-relaxed text-muted-foreground/50">
          non-custodial · orders sign client-side with your Lighter API key
        </p>
      )}
    </div>
  );
}

function Row({ k, v, tone = "text-foreground" }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground/60">{k}</span>
      <span className={tone}>{v}</span>
    </div>
  );
}
