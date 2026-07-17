"use client";

import { useEffect, useMemo, useState } from "react";
import { StockLogo } from "@/components/brand/stock-logo";
import { STOCKS } from "@/lib/stocks";
import { fetchOhlc, computeIndicators, type Indicators } from "@/lib/quant";
import { analyzeScreen } from "@/lib/agents";
import type { KeyBinding } from "@/lib/agents";

type TrendFilter = "any" | "up" | "down" | "flat";
type SortKey = "score" | "return3m" | "rsi14" | "volAnnual" | "sharpe" | "symbol";

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const money = (x: number) => (x >= 1000 ? x.toFixed(0) : x.toFixed(2));

export function Screener({
  binding, onChart, onBuy,
}: {
  binding: KeyBinding | null;
  onChart: (s: string) => void;
  onBuy: (s: string) => void;
}) {
  const [ind, setInd] = useState<Record<string, Indicators>>({});
  const [loaded, setLoaded] = useState(0);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [trend, setTrend] = useState<TrendFilter>("any");
  const [rsiMax, setRsiMax] = useState(100);
  const [minSharpe, setMinSharpe] = useState(-5);
  const [sort, setSort] = useState<SortKey>("return3m");
  const [scores, setScores] = useState<Record<string, { score: number; note: string }>>({});
  const [ranking, setRanking] = useState(false);
  const [rankErr, setRankErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const out: Record<string, Indicators> = {};
      let done = 0;
      await Promise.all(
        STOCKS.map(async (s) => {
          try {
            const data = await fetchOhlc(s.symbol, "3m");
            out[s.symbol] = computeIndicators(data);
          } catch { /* skip a failed symbol */ }
          if (alive) setLoaded(++done);
        }),
      );
      if (alive) { setInd(out); setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => {
    let list = Object.values(ind);
    if (q.trim()) {
      const needle = q.trim().toUpperCase();
      list = list.filter((i) => i.symbol.includes(needle) || (STOCKS.find((s) => s.symbol === i.symbol)?.name.toUpperCase().includes(needle)));
    }
    if (trend !== "any") list = list.filter((i) => i.trend === trend);
    list = list.filter((i) => i.rsi14 <= rsiMax && i.sharpe >= minSharpe);
    list.sort((a, b) => {
      if (sort === "symbol") return a.symbol.localeCompare(b.symbol);
      if (sort === "score") return (scores[b.symbol]?.score ?? 0) - (scores[a.symbol]?.score ?? 0);
      return (b[sort] as number) - (a[sort] as number);
    });
    return list;
  }, [ind, q, trend, rsiMax, minSharpe, sort, scores]);

  const runRank = async () => {
    if (!binding) { setRankErr("Bind an intelligence key to rank with AI."); return; }
    setRanking(true); setRankErr(null);
    try {
      const ranked = await analyzeScreen(binding, rows);
      const map: Record<string, { score: number; note: string }> = {};
      ranked.forEach((r) => (map[r.symbol.toUpperCase()] = { score: r.score, note: r.note }));
      setScores(map);
      setSort("score");
    } catch (e) {
      setRankErr((e as Error).message);
    } finally {
      setRanking(false);
    }
  };

  const th = "px-2 py-1.5 text-left font-mono text-[9px] uppercase tracking-widest text-muted-foreground cursor-pointer select-none hover:text-foreground";

  return (
    <div className="grid gap-3">
      {/* filters */}
      <div className="flex flex-wrap items-end gap-3 border border-border bg-card p-3">
        <label className="grid gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="NVDA · nvidia"
            className="w-40 border border-input bg-background px-2 py-1 font-mono text-[12px] text-foreground focus:border-signal/60 focus:outline-none" />
        </label>
        <label className="grid gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Trend</span>
          <select value={trend} onChange={(e) => setTrend(e.target.value as TrendFilter)}
            className="border border-input bg-background px-2 py-1 font-mono text-[12px] text-foreground focus:outline-none">
            <option value="any">any</option><option value="up">up</option><option value="flat">flat</option><option value="down">down</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">RSI ≤ {rsiMax}</span>
          <input type="range" min={20} max={100} value={rsiMax} onChange={(e) => setRsiMax(Number(e.target.value))} className="w-28 accent-signal" />
        </label>
        <label className="grid gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Min Sharpe {minSharpe.toFixed(1)}</span>
          <input type="range" min={-5} max={5} step={0.5} value={minSharpe} onChange={(e) => setMinSharpe(Number(e.target.value))} className="w-28 accent-signal" />
        </label>
        <button onClick={runRank} disabled={ranking || loading}
          className="ml-auto border border-signal/60 bg-signal/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-signal transition-colors hover:bg-signal/20 disabled:opacity-40">
          {ranking ? "analyzing…" : "◈ rank with AI"}
        </button>
      </div>
      {rankErr && <div className="border border-[#ff5c5c]/40 bg-[#ff5c5c]/5 px-3 py-2 font-mono text-[11px] text-[#ff5c5c]">{rankErr}</div>}

      {/* table */}
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={th} onClick={() => setSort("symbol")}>Instrument</th>
              <th className={th}>Price</th>
              <th className={th} onClick={() => setSort("return3m")}>3m</th>
              <th className={th} onClick={() => setSort("rsi14")}>RSI</th>
              <th className={th} onClick={() => setSort("volAnnual")}>Vol</th>
              <th className={th} onClick={() => setSort("sharpe")}>Sharpe</th>
              <th className={th}>Regime</th>
              {Object.keys(scores).length > 0 && <th className={th} onClick={() => setSort("score")}>AI</th>}
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="px-3 py-8 text-center font-mono text-[11px] text-muted-foreground">measuring {loaded}/{STOCKS.length} instruments…</td></tr>
            )}
            {!loading && rows.map((i) => {
              const name = STOCKS.find((s) => s.symbol === i.symbol)?.name ?? i.symbol;
              const sc = scores[i.symbol];
              return (
                <tr key={i.symbol} className="border-b border-border/60 transition-colors hover:bg-signal/[0.04]">
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <StockLogo symbol={i.symbol} size={22} />
                      <div>
                        <div className="font-mono text-[12px] text-foreground">{i.symbol}</div>
                        <div className="text-[10px] text-muted-foreground">{name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[12px] tabular-nums">${money(i.price)}</td>
                  <td className={`px-2 py-1.5 font-mono text-[12px] tabular-nums ${i.return3m >= 0 ? "text-signal" : "text-[#ff5c5c]"}`}>{pct(i.return3m)}</td>
                  <td className="px-2 py-1.5 font-mono text-[12px] tabular-nums">{i.rsi14.toFixed(0)}</td>
                  <td className="px-2 py-1.5 font-mono text-[12px] tabular-nums">{(i.volAnnual * 100).toFixed(0)}%</td>
                  <td className="px-2 py-1.5 font-mono text-[12px] tabular-nums">{i.sharpe.toFixed(2)}</td>
                  <td className="px-2 py-1.5">
                    <span className={`font-mono text-[9px] uppercase tracking-widest ${i.regime === "risk-on" ? "text-signal" : i.regime === "risk-off" ? "text-[#ff5c5c]" : "text-muted-foreground"}`}>{i.regime}</span>
                  </td>
                  {Object.keys(scores).length > 0 && (
                    <td className="px-2 py-1.5">
                      {sc ? <div><span className="font-mono text-[12px] text-signal">{sc.score}</span><div className="text-[9px] text-muted-foreground">{sc.note}</div></div> : <span className="text-muted-foreground">—</span>}
                    </td>
                  )}
                  <td className="px-2 py-1.5">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => onChart(i.symbol)} className="border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:border-signal/40 hover:text-signal">chart</button>
                      <button onClick={() => onBuy(i.symbol)} className="border border-signal/50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-signal hover:bg-signal/10">buy</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center font-mono text-[11px] text-muted-foreground">no instruments match these filters</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
