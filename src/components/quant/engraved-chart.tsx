"use client";

import { useEffect, useRef, useState } from "react";
import type { Candle } from "@/lib/quant";

const SIGNAL = "#34F003";
const RED = "#ff5c5c";

// A price chart drawn as an engraving: a hatched "measured deep" beneath a glowing close-line,
// two SMA hairlines, and a crosshair that reads the exact close. Canvas 2D, no chart lib. The
// hover state lives in a ref so the canvas never re-inits on scroll (no flicker).
export function EngravedChart({
  candles,
  sma20 = [],
  sma50 = [],
  up = true,
  height = 300,
}: {
  candles: Candle[];
  sma20?: number[];
  sma50?: number[];
  up?: boolean;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<number | null>(null);
  const [readout, setReadout] = useState<Candle | null>(null);
  const col = up ? SIGNAL : RED;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas || candles.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, alive = true;
    const padT = 16, padB = 26, padR = 60, padL = 8;

    const lows = candles.map((k) => k.l);
    const highs = candles.map((k) => k.h);
    let lo = Math.min(...lows), hi = Math.max(...highs);
    const span = hi - lo || hi || 1;
    lo -= span * 0.08; hi += span * 0.08;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      W = r.width; H = height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const xOf = (i: number) => padL + (i / (candles.length - 1)) * (W - padL - padR);
    const yOf = (p: number) => padT + (1 - (p - lo) / (hi - lo)) * (H - padT - padB);

    const draw = () => {
      if (!alive) return;
      ctx.clearRect(0, 0, W, H);

      // hairline grid + right-edge price ticks (engraved plate)
      ctx.strokeStyle = "rgba(242,241,236,0.06)";
      ctx.fillStyle = "rgba(242,241,236,0.34)";
      ctx.font = '10px "Space Mono", monospace';
      ctx.lineWidth = 1;
      for (let g = 0; g <= 4; g++) {
        const p = lo + (g / 4) * (hi - lo);
        const y = yOf(p);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.fillText(p >= 1000 ? p.toFixed(0) : p.toFixed(2), W - padR + 6, y + 3);
      }

      // the close path
      const linePath = new Path2D();
      candles.forEach((k, i) => {
        const x = xOf(i), y = yOf(k.c);
        if (i === 0) linePath.moveTo(x, y); else linePath.lineTo(x, y);
      });

      // engraved cross-hatch fill under the line (Blake's "measured deep")
      const areaPath = new Path2D(linePath);
      areaPath.lineTo(xOf(candles.length - 1), H - padB);
      areaPath.lineTo(xOf(0), H - padB);
      areaPath.closePath();
      ctx.save();
      ctx.clip(areaPath);
      const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
      grad.addColorStop(0, up ? "rgba(52,240,3,0.14)" : "rgba(255,92,92,0.12)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = up ? "rgba(52,240,3,0.16)" : "rgba(255,92,92,0.14)";
      ctx.lineWidth = 0.6;
      for (let x = -H; x < W; x += 7) {
        ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.stroke();
      }
      ctx.restore();

      // SMA hairlines
      const drawSma = (arr: number[], alpha: number, dash: number[]) => {
        if (!arr.length) return;
        ctx.save();
        ctx.setLineDash(dash);
        ctx.strokeStyle = `rgba(242,241,236,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        let started = false;
        arr.forEach((v, i) => {
          if (Number.isNaN(v)) return;
          const x = xOf(i), y = yOf(v);
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.restore();
      };
      drawSma(sma50, 0.28, [2, 3]);
      drawSma(sma20, 0.5, []);

      // the close line, glowing
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = reduce ? 4 : 8;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.8;
      ctx.stroke(linePath);
      ctx.restore();

      // static marker at the last close (no per-frame animation → no jitter while scrolling)
      const lx = xOf(candles.length - 1), ly = yOf(candles[candles.length - 1].c);
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(lx, ly, 2.4, 0, Math.PI * 2); ctx.fill();

      // crosshair
      const hi_ = hoverRef.current;
      if (hi_ != null && hi_ >= 0 && hi_ < candles.length) {
        const x = xOf(hi_), y = yOf(candles[hi_].c);
        ctx.strokeStyle = "rgba(242,241,236,0.28)";
        ctx.setLineDash([2, 2]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, H - padB); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#0a0a0b"; ctx.strokeStyle = col; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }

    };
    draw(); // draw once — the chart is static; it only redraws on hover or resize

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const i = Math.round(((x - padL) / (W - padL - padR)) * (candles.length - 1));
      const clamped = Math.max(0, Math.min(candles.length - 1, i));
      hoverRef.current = clamped;
      setReadout(candles[clamped]);
      draw();
    };
    const onLeave = () => { hoverRef.current = null; setReadout(null); draw(); };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      alive = false;
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [candles, sma20, sma50, up, height, col]);

  return (
    <div ref={wrapRef} className="relative w-full">
      <canvas ref={canvasRef} className="block w-full cursor-crosshair" />
      {readout && (
        <div className="pointer-events-none absolute left-2 top-2 border border-border bg-background/85 px-2 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur">
          <span className="text-foreground">
            {new Date(readout.t * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>{" "}
          O {readout.o.toFixed(2)} H {readout.h.toFixed(2)} L {readout.l.toFixed(2)}{" "}
          <span style={{ color: col }}>C {readout.c.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
