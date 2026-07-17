"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { DeepPartial, Styles } from "klinecharts"; // type-only import — erased at runtime, no SSR/window issue
import type { Candle } from "@/lib/quant";

// KLineChart (v10) wrapped for the terminal. Browser-only — klinecharts touches `window` at module
// load, so it's dynamically imported inside the effect (never at top level / SSR). Exposes an
// imperative handle so the Horizon agent (P3) can draw overlays and add indicators programmatically,
// and map (timestamp, price) → screen pixels for the visible cursor.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Chart = any;
export type OverlayPoint = { timestamp: number; value: number };
export type ChartHandle = {
  addIndicator: (name: string, sub?: boolean) => void;
  removeIndicators: () => void;
  createOverlay: (name: string, points: OverlayPoint[], extra?: Record<string, unknown>) => void;
  drawHLine: (price: number) => void;
  clearOverlays: () => void;
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
    tooltip: { legend: { color: "#f2f1ec" }, rect: { color: "rgba(10,10,11,0.9)", borderColor: "rgba(242,241,236,0.1)" } },
  },
  indicator: {
    lines: [{ color: SIGNAL }, { color: "#7aa2ff" }, { color: "#f0a500" }, { color: "#c678dd" }],
    bars: [{ upColor: "rgba(52,240,3,0.5)", downColor: "rgba(255,90,90,0.5)", noChangeColor: "#8a8a8f" }],
    tooltip: { text: { color: "#8a8a8f" } },
  },
  xAxis: { axisLine: { color: "rgba(242,241,236,0.1)" }, tickLine: { color: "rgba(242,241,236,0.1)" }, tickText: { color: "#8a8a8f", size: 10 } },
  yAxis: { axisLine: { color: "rgba(242,241,236,0.1)" }, tickLine: { color: "rgba(242,241,236,0.1)" }, tickText: { color: "#8a8a8f", size: 10 } },
  crosshair: {
    horizontal: { line: { color: "rgba(52,240,3,0.4)" }, text: { backgroundColor: SIGNAL, color: "#04140a" } },
    vertical: { line: { color: "rgba(52,240,3,0.4)" }, text: { backgroundColor: "rgba(52,240,3,0.15)", color: SIGNAL } },
  },
  // agent drawings — all signal green
  overlay: {
    point: { color: SIGNAL, borderColor: "rgba(52,240,3,0.25)", activeColor: SIGNAL },
    line: { color: SIGNAL },
    rect: { color: "rgba(52,240,3,0.06)", borderColor: SIGNAL },
    text: { color: "#04140a", backgroundColor: SIGNAL, borderColor: SIGNAL },
    polygon: { color: SIGNAL, borderColor: SIGNAL },
  },
} as unknown as DeepPartial<Styles>;

const toKLine = (c: Candle[]) => c.map((k) => ({ timestamp: k.t * 1000, open: k.o, high: k.h, low: k.l, close: k.c, volume: k.v }));

export const KlineChart = forwardRef<ChartHandle, { candles: Candle[]; symbol: string; precision?: number }>(
  function KlineChart({ candles, symbol, precision = 2 }, ref) {
    const boxRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<Chart>(null);
    const overlayIds = useRef<string[]>([]);
    const indicatorIds = useRef<string[]>([]);
    const dataRef = useRef<Candle[]>(candles);
    dataRef.current = candles;

    // init once
    useEffect(() => {
      let disposed = false;
      let chart: Chart = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let disposeFn: ((el: any) => void) | null = null;
      const el = boxRef.current;
      if (!el) return;
      import("klinecharts").then((kc) => {
        if (disposed || !boxRef.current) return;
        disposeFn = kc.dispose;
        chart = kc.init(boxRef.current, { styles });
        chartRef.current = chart;
        chart.setSymbol({ ticker: symbol, pricePrecision: precision, volumePrecision: 0 });
        chart.setPeriod({ type: "day", span: 1 });
        chart.setDataLoader({
          // static dataset from our API: hand back everything on init, nothing on paging
          getBars: (p: { type: string; callback: (d: unknown[], more?: boolean) => void }) => {
            p.callback(p.type === "init" ? toKLine(dataRef.current) : [], false);
          },
        });
        indicatorIds.current = [chart.createIndicator("VOL", false)].filter(Boolean);
        const ro = new ResizeObserver(() => chart?.resize());
        ro.observe(boxRef.current);
        // stash the observer on the chart so cleanup can reach it
        chart.__ro = ro;
      });
      return () => {
        disposed = true;
        try { chartRef.current?.__ro?.disconnect(); } catch { /* noop */ }
        if (disposeFn && el) { try { disposeFn(el); } catch { /* noop */ } }
        chartRef.current = null;
      };
      // init once; symbol/data changes are handled by the reload effect below (no re-init flicker)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // reload data when candles/symbol change (re-set symbol + reload)
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      overlayIds.current = []; // drawings are per-instrument; clear on switch
      chart.setSymbol({ ticker: symbol, pricePrecision: precision, volumePrecision: 0 });
      chart.setDataLoader({
        getBars: (p: { type: string; callback: (d: unknown[], more?: boolean) => void }) => {
          p.callback(p.type === "init" ? toKLine(dataRef.current) : [], false);
        },
      });
    }, [candles, symbol, precision]);

    useImperativeHandle(ref, (): ChartHandle => ({
      addIndicator: (name) => {
        const chart = chartRef.current; if (!chart) return;
        // MA/EMA/BOLL/SAR overlay the candle pane; oscillators (RSI/MACD/KDJ/VOL) get their own sub-pane
        const overlayInd = ["MA", "EMA", "SMA", "BOLL", "SAR"].includes(name);
        const id = overlayInd ? chart.createIndicator({ name }, false, { id: "candle_pane" }) : chart.createIndicator(name, false);
        if (typeof id === "string") indicatorIds.current.push(id);
      },
      removeIndicators: () => {
        indicatorIds.current.forEach((id) => chartRef.current?.removeIndicator?.(id));
        indicatorIds.current = [];
      },
      createOverlay: (name, points, extra = {}) => {
        const id = chartRef.current?.createOverlay({ name, points, ...extra });
        if (typeof id === "string") overlayIds.current.push(id);
      },
      drawHLine: (price) => {
        const id = chartRef.current?.createOverlay({ name: "priceLine", points: [{ value: price }] });
        if (typeof id === "string") overlayIds.current.push(id);
      },
      clearOverlays: () => { chartRef.current?.removeOverlay?.(); overlayIds.current = []; },
      coord: (timestampMs, price) => {
        const c = chartRef.current?.convertToPixel({ timestamp: timestampMs, value: price });
        if (!c || c.x == null || c.y == null) return null;
        const r = boxRef.current?.getBoundingClientRect();
        return r ? { x: r.left + c.x, y: r.top + c.y } : null;
      },
      lastTimestamp: () => { const d = dataRef.current; return d.length ? d[d.length - 1].t * 1000 : null; },
    }), []);

    return <div ref={boxRef} className="h-full w-full" />;
  },
);
