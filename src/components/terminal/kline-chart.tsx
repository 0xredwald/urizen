"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { DeepPartial, Styles } from "klinecharts"; // type-only import — erased at runtime, no SSR/window issue
import type { Candle } from "@/lib/quant";

// KLineChart (v10) wrapped for the terminal. Browser-only — klinecharts touches `window` at module
// load, so it's dynamically imported inside the effect (never at top level / SSR). The chart LOADS ITS
// OWN DATA via setDataLoader: getBars("init") pulls the newest window, getBars("backward") pages older
// history as you scroll left (full on-chain history), and subscribeBar polls the newest candle so the
// chart updates live 24/7. Exposes an imperative handle so the agent can draw + map coords.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Chart = any;
export type OverlayPoint = { timestamp: number; value: number };
export type ChartHandle = {
  addIndicator: (name: string, sub?: boolean) => void;
  removeIndicators: () => void;
  removeLastIndicator: () => boolean;
  createOverlay: (name: string, points: OverlayPoint[], extra?: Record<string, unknown>) => void;
  /** enter interactive draw mode — user clicks the chart to place the overlay's points. */
  startDraw: (name: string) => void;
  drawHLine: (price: number) => void;
  clearOverlays: () => void;
  removeLastOverlay: () => boolean;
  hasDrawings: () => boolean;
  /** (timestampMs, price) → viewport {x,y} for the agent cursor to trace. */
  coord: (timestampMs: number, price: number) => { x: number; y: number } | null;
  lastTimestamp: () => number | null;
};

const SIGNAL = "#34F003";
const RED = "#ff5a5a";

const styles = {
  grid: { horizontal: { color: "rgba(242,241,236,0.04)" }, vertical: { color: "rgba(242,241,236,0.04)" } },
  candle: {
    bar: { upColor: SIGNAL, downColor: RED, noChangeColor: "#8a8a8f", upBorderColor: SIGNAL, downBorderColor: RED, upWickColor: SIGNAL, downWickColor: RED },
    priceMark: {
      last: { upColor: SIGNAL, downColor: RED, line: { style: "dashed", dashedValue: [3, 3] }, text: { color: "#04140a" } },
      high: { color: "#8a8a8f" }, low: { color: "#8a8a8f" },
    },
    tooltip: { showRule: "follow_cross", legend: { color: "#f2f1ec" }, rect: { color: "rgba(10,10,11,0.9)", borderColor: "rgba(242,241,236,0.1)" } },
  },
  indicator: {
    lines: [{ color: SIGNAL }, { color: "#7aa2ff" }, { color: "#f0a500" }, { color: "#c678dd" }],
    bars: [{ upColor: "rgba(52,240,3,0.5)", downColor: "rgba(255,90,90,0.5)", noChangeColor: "#8a8a8f" }],
    tooltip: { showRule: "follow_cross", text: { color: "#8a8a8f" } },
  },
  xAxis: { axisLine: { color: "rgba(242,241,236,0.1)" }, tickLine: { color: "rgba(242,241,236,0.1)" }, tickText: { color: "#8a8a8f", size: 10 } },
  yAxis: { axisLine: { color: "rgba(242,241,236,0.1)" }, tickLine: { color: "rgba(242,241,236,0.1)" }, tickText: { color: "#8a8a8f", size: 10 } },
  crosshair: {
    horizontal: { line: { color: "rgba(52,240,3,0.4)" }, text: { backgroundColor: SIGNAL, color: "#04140a" } },
    vertical: { line: { color: "rgba(52,240,3,0.4)" }, text: { backgroundColor: "rgba(52,240,3,0.15)", color: SIGNAL } },
  },
  overlay: {
    point: { color: SIGNAL, borderColor: "rgba(52,240,3,0.25)", activeColor: SIGNAL },
    line: { color: SIGNAL },
    rect: { color: "rgba(52,240,3,0.06)", borderColor: SIGNAL },
    text: { color: "#04140a", backgroundColor: SIGNAL, borderColor: SIGNAL },
    polygon: { color: SIGNAL, borderColor: SIGNAL },
  },
} as unknown as DeepPartial<Styles>;

const toKLine = (c: Candle[]) => c.map((k) => ({ timestamp: k.t * 1000, open: k.o, high: k.h, low: k.l, close: k.c, volume: k.v }));

// interval → KLineChart period (minute periods show time on the axis; day/week show dates)
const periodFor = (interval: string): { type: string; span: number } => {
  switch (interval) {
    case "1m": return { type: "minute", span: 1 };
    case "5m": return { type: "minute", span: 5 };
    case "15m": return { type: "minute", span: 15 };
    case "1h": return { type: "hour", span: 1 };
    case "4h": return { type: "hour", span: 4 };
    case "1D": return { type: "day", span: 1 };
    case "1W": return { type: "week", span: 1 };
    default: return { type: "minute", span: 15 };
  }
};

async function fetchOhlc(symbol: string, interval: string, before?: number): Promise<Candle[]> {
  const q = new URLSearchParams({ symbol, interval });
  if (before) q.set("before", String(before));
  try {
    const d = await fetch(`/api/quant/ohlc?${q.toString()}`, { cache: "no-store" }).then((r) => r.json());
    return (d?.candles as Candle[]) ?? [];
  } catch { return []; }
}

export const KlineChart = forwardRef<ChartHandle, { symbol: string; interval: string; precision?: number }>(
  function KlineChart({ symbol, interval, precision = 2 }, ref) {
    const boxRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<Chart>(null);
    const overlayIds = useRef<string[]>([]);
    const indicatorIds = useRef<string[]>([]);
    // keep the latest symbol/interval reachable inside the (stable) data-loader closures
    const sym = useRef(symbol); sym.current = symbol;
    const itv = useRef(interval); itv.current = interval;
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // build the data loader for the current symbol/interval
    const makeLoader = () => ({
      getBars: async (p: { type: string; callback: (d: unknown[], more?: boolean) => void }) => {
        if (p.type === "init") {
          const c = await fetchOhlc(sym.current, itv.current);
          p.callback(toKLine(c), c.length > 0); // allow backward paging
        } else if (p.type === "backward") {
          // page older history before the earliest candle currently held
          const list = chartRef.current?.getDataList?.() ?? [];
          const earliest = list.length ? Math.floor(list[0].timestamp / 1000) : undefined;
          const c = await fetchOhlc(sym.current, itv.current, earliest);
          p.callback(toKLine(c), c.length > 0);
        } else {
          p.callback([], false);
        }
      },
      // live: poll the newest candle and feed it in (updates the last bar or appends a new one)
      subscribeBar: (p: { callback: (d: unknown) => void }) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          const c = await fetchOhlc(sym.current, itv.current);
          const last = c[c.length - 1];
          if (last) p.callback(toKLine([last])[0]);
        }, 12000);
      },
      unsubscribeBar: () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } },
    });

    // init once
    useEffect(() => {
      let disposed = false;
      let disposeFn: ((el: HTMLElement) => void) | null = null;
      const el = boxRef.current;
      if (!el) return;
      import("klinecharts").then((kc) => {
        if (disposed || !boxRef.current) return;
        disposeFn = kc.dispose;
        const chart: Chart = kc.init(boxRef.current, { styles });
        chartRef.current = chart;
        chart.setSymbol({ ticker: sym.current, pricePrecision: precision, volumePrecision: 0 });
        chart.setPeriod(periodFor(itv.current));
        chart.setDataLoader(makeLoader());
        indicatorIds.current = [chart.createIndicator("VOL", false)].filter(Boolean);
        const ro = new ResizeObserver(() => chart?.resize());
        ro.observe(boxRef.current);
        chart.__ro = ro;
      });
      return () => {
        disposed = true;
        if (pollRef.current) clearInterval(pollRef.current);
        try { chartRef.current?.__ro?.disconnect(); } catch { /* noop */ }
        if (disposeFn && el) { try { disposeFn(el); } catch { /* noop */ } }
        chartRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // symbol / interval change → retarget + reset the loader (re-triggers init getBars, no flicker of history)
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      overlayIds.current = []; // drawings are per-instrument
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      chart.setSymbol({ ticker: symbol, pricePrecision: precision, volumePrecision: 0 });
      chart.setPeriod(periodFor(interval));
      chart.setDataLoader(makeLoader());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, interval, precision]);

    useImperativeHandle(ref, (): ChartHandle => ({
      addIndicator: (name) => {
        const chart = chartRef.current; if (!chart) return;
        const overlayInd = ["MA", "EMA", "SMA", "BOLL", "SAR"].includes(name);
        const id = overlayInd ? chart.createIndicator({ name }, false, { id: "candle_pane" }) : chart.createIndicator(name, false);
        if (typeof id === "string") indicatorIds.current.push(id);
      },
      removeIndicators: () => {
        indicatorIds.current.forEach((id) => chartRef.current?.removeIndicator?.({ id }));
        indicatorIds.current = [];
      },
      removeLastIndicator: () => {
        const id = indicatorIds.current.pop();
        if (!id) return false;
        chartRef.current?.removeIndicator?.({ id });
        return true;
      },
      createOverlay: (name, points, extra = {}) => {
        const id = chartRef.current?.createOverlay({ name, points, ...extra });
        if (typeof id === "string") overlayIds.current.push(id);
      },
      startDraw: (name) => {
        const id = chartRef.current?.createOverlay({ name }); // no points → interactive draw
        if (typeof id === "string") overlayIds.current.push(id);
      },
      drawHLine: (price) => {
        const id = chartRef.current?.createOverlay({ name: "priceLine", points: [{ value: price }] });
        if (typeof id === "string") overlayIds.current.push(id);
      },
      clearOverlays: () => { chartRef.current?.removeOverlay?.(); overlayIds.current = []; },
      removeLastOverlay: () => {
        const id = overlayIds.current.pop();
        if (!id) return false;
        chartRef.current?.removeOverlay?.({ id });
        return true;
      },
      hasDrawings: () => overlayIds.current.length > 0,
      coord: (timestampMs, price) => {
        const c = chartRef.current?.convertToPixel({ timestamp: timestampMs, value: price });
        if (!c || c.x == null || c.y == null) return null;
        const r = boxRef.current?.getBoundingClientRect();
        return r ? { x: r.left + c.x, y: r.top + c.y } : null;
      },
      lastTimestamp: () => { const d = chartRef.current?.getDataList?.() ?? []; return d.length ? d[d.length - 1].timestamp : null; },
    }), []);

    return <div ref={boxRef} className="h-full w-full" />;
  },
);
