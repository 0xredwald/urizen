"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { backtest, type BacktestResult } from "@/lib/backtest";
import type { AgentConfig } from "@/lib/agent-graph";
import type { OhlcResponse } from "@/lib/quant";

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;

function EquityCurve({ res }: { res: BacktestResult }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = ref.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const draw = () => {
      const W = wrap.getBoundingClientRect().width, H = 150;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const all = [...res.equity.map((e) => e.v), ...res.benchmark.map((e) => e.v)];
      const lo = Math.min(...all), hi = Math.max(...all);
      const pad = 8;
      const x = (i: number, len: number) => pad + (i / (len - 1)) * (W - pad * 2);
      const y = (v: number) => pad + (1 - (v - lo) / (hi - lo || 1)) * (H - pad * 2);
      // benchmark
      ctx.strokeStyle = "rgba(242,241,236,0.35)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath();
      res.benchmark.forEach((e, i) => { const px = x(i, res.benchmark.length), py = y(e.v); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke(); ctx.setLineDash([]);
      // equity
      const up = res.totalReturn >= 0;
      ctx.strokeStyle = up ? "#34F003" : "#ff5c5c"; ctx.lineWidth = 1.8;
      ctx.shadowColor = up ? "#34F003" : "#ff5c5c"; ctx.shadowBlur = 6;
      ctx.beginPath();
      res.equity.forEach((e, i) => { const px = x(i, res.equity.length), py = y(e.v); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke(); ctx.shadowBlur = 0;
    };
    draw();
    const ro = new ResizeObserver(draw); ro.observe(wrap);
    return () => ro.disconnect();
  }, [res]);
  return <div ref={wrapRef} className="w-full"><canvas ref={ref} className="block w-full" /></div>;
}

export function BacktestPanel({ config, series }: { config: AgentConfig; series: Record<string, OhlcResponse> }) {
  const [res, setRes] = useState<BacktestResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ready = useMemo(() => config.instruments.some((s) => series[s]?.candles?.length), [config.instruments, series]);

  const run = () => {
    setErr(null);
    try { setRes(backtest(config, series)); }
    catch (e) { setErr((e as Error).message); }
  };

  const beat = res ? res.totalReturn - res.benchReturn : 0;

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Backtest · real history, no lookahead</span>
        <button
          onClick={run}
          disabled={!ready}
          className="border border-signal/60 bg-signal/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-signal transition-colors hover:bg-signal/20 disabled:opacity-40"
        >
          {res ? "re-run ⟲" : "run backtest ▶"}
        </button>
      </div>

      {err && <div className="px-4 py-3 font-mono text-[11px] text-[#ff5c5c]">{err}</div>}
      {!res && !err && (
        <div className="px-4 py-8 text-center font-mono text-[11px] text-muted-foreground">
          Simulate this exact config over the loaded price history.
        </div>
      )}

      {res && (
        <div className="grid gap-3 p-4">
          <EquityCurve res={res} />
          <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: res.totalReturn >= 0 ? "#34F003" : "#ff5c5c" }} /> agent</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t border-dashed border-white/40" /> equal-weight hold</span>
          </div>
          <div className="grid grid-cols-3 gap-px border border-border bg-border sm:grid-cols-6">
            {[
              ["Return", pct(res.totalReturn), res.totalReturn >= 0],
              ["vs Hold", pct(beat), beat >= 0],
              ["Sharpe", res.sharpe.toFixed(2), res.sharpe >= 0],
              ["Max DD", `−${(res.maxDrawdown * 100).toFixed(0)}%`, false],
              ["Win rate", `${(res.winRate * 100).toFixed(0)}%`, res.winRate >= 0.5],
              ["Trades", String(res.trades), true],
            ].map(([k, v, good]) => (
              <div key={k as string} className="bg-card px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</div>
                <div className={`font-mono text-sm tabular-nums ${good ? "text-foreground" : "text-[#ff5c5c]"}`}>{v}</div>
              </div>
            ))}
          </div>
          <p className="font-mono text-[9px] leading-relaxed text-muted-foreground">
            Past simulation on daily closes — not a forward guarantee, not investment advice. Slippage,
            fees and intraday fills are idealized.
          </p>
        </div>
      )}
    </div>
  );
}
