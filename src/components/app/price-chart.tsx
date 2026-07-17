"use client";

import { useEffect, useRef, useState } from "react";
import type { Candle } from "@/lib/onchain";
import { price as fmtPrice, pct, compact } from "@/lib/format";

const SIGNAL = "#34F003";
const RED = "#ff5c5c";

/** Real $URI price chart — glowing close-area + subtle candles, live pulse,
 *  hover crosshair. Hover lives in a ref so the canvas never re-inits (no flicker
 *  on scroll). Canvas 2D, no chart lib. */
export function PriceChart({
  candles,
  priceUsd,
  change24h,
  volume24h,
}: {
  candles: Candle[];
  priceUsd: number;
  change24h: number;
  volume24h: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<{ x: number; c: Candle } | null>(null);
  const [readout, setReadout] = useState<Candle | null>(null);
  const up = change24h >= 0;
  const col = up ? SIGNAL : RED;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas || candles.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0, H = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0, phase = 0, alive = true;
    const padT = 14, padB = 22, padR = 66, padL = 8;

    const sortedL = candles.map((k) => k.l).sort((a, b) => a - b);
    const sortedH = candles.map((k) => k.h).sort((a, b) => a - b);
    const q = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * p)))];
    let lo = q(sortedL, 0.02), hi = q(sortedH, 0.96);
    if (!(hi > lo)) { lo = sortedL[0]; hi = sortedH[sortedH.length - 1]; }
    const span = hi - lo || hi || 1;
    lo -= span * 0.12; hi += span * 0.12;

    const resize = () => {
      W = wrap.clientWidth; H = wrap.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const X = (i: number) => padL + (i / (candles.length - 1)) * (W - padL - padR);
    const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const clampY = (y: number) => Math.max(padT, Math.min(H - padB, y));
    const Yc = (v: number) => clampY(Y(v));

    const draw = () => {
      if (!alive) return;
      ctx.clearRect(0, 0, W, H);

      ctx.font = "10px 'Space Mono', monospace";
      ctx.textBaseline = "middle";
      for (let g = 0; g <= 4; g++) {
        const v = lo + (g / 4) * (hi - lo);
        const y = Y(v);
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.textAlign = "left";
        ctx.fillText(fmtPrice(v).replace("$", ""), W - padR + 6, y);
      }

      const lastX = X(candles.length - 1);

      const cw = Math.max(1.5, (W - padL - padR) / candles.length * 0.55);
      candles.forEach((k, i) => {
        const x = X(i);
        const green = k.c >= k.o;
        ctx.strokeStyle = green ? "rgba(52,240,3,0.28)" : "rgba(255,92,92,0.26)";
        ctx.fillStyle = green ? "rgba(52,240,3,0.28)" : "rgba(255,92,92,0.26)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, Yc(k.h)); ctx.lineTo(x, Yc(k.l)); ctx.stroke();
        const yo = Yc(k.o), yc = Yc(k.c);
        ctx.fillRect(x - cw / 2, Math.min(yo, yc), cw, Math.max(1, Math.abs(yc - yo)));
      });

      ctx.beginPath();
      candles.forEach((k, i) => { const x = X(i), y = Yc(k.c); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.lineTo(lastX, H - padB); ctx.lineTo(X(0), H - padB); ctx.closePath();
      const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
      grad.addColorStop(0, up ? "rgba(52,240,3,0.24)" : "rgba(255,92,92,0.2)");
      grad.addColorStop(1, "rgba(52,240,3,0)");
      ctx.fillStyle = grad; ctx.fill();

      ctx.beginPath();
      candles.forEach((k, i) => { const x = X(i), y = Yc(k.c); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.strokeStyle = col; ctx.lineWidth = 2.2;
      ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;

      const ly = Yc(candles[candles.length - 1].c);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(lastX, ly); ctx.stroke(); ctx.setLineDash([]);
      const r = reduce ? 3 : 3 + Math.sin(phase) * 1.6;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lastX, ly, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = reduce ? 0.25 : 0.25 + Math.sin(phase) * 0.2;
      ctx.beginPath(); ctx.arc(lastX, ly, r * 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;

      const hv = hoverRef.current;
      if (hv) {
        const idx = Math.max(0, Math.min(candles.length - 1, Math.round(((hv.x - padL) / (W - padL - padR)) * (candles.length - 1))));
        const k = candles[idx];
        if (k) {
          const x = X(idx);
          ctx.strokeStyle = "rgba(255,255,255,0.18)";
          ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, H - padB); ctx.stroke();
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, Yc(k.c), 2.6, 0, Math.PI * 2); ctx.fill();
        }
      }

      phase += 0.06;
      raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [candles, up, col]);

  const onMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = Math.round(((x - 8) / (rect.width - 74)) * (candles.length - 1));
    const c = candles[Math.max(0, Math.min(candles.length - 1, i))];
    if (c) { hoverRef.current = { x, c }; setReadout(c); }
  };
  const onLeave = () => { hoverRef.current = null; setReadout(null); };

  return (
    <div className="flex h-full flex-col rounded-[4px] border border-white/[0.08] bg-white/[0.015] p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-base text-muted-foreground">$URI price</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-display text-4xl tabular-nums text-foreground">{fmtPrice(priceUsd)}</span>
            <span className="font-display text-base tabular-nums" style={{ color: col }}>{pct(change24h)}</span>
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          {readout ? (
            <>
              <div className="font-display text-base text-foreground">{fmtPrice(readout.c)}</div>
              <div className="mt-1">
                {new Date(readout.t * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit" })}
              </div>
            </>
          ) : (
            <>
              <div>24h volume</div>
              <div className="font-display text-base text-foreground">${compact(volume24h)}</div>
            </>
          )}
        </div>
      </div>
      <div
        ref={wrapRef}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="relative mt-4 min-h-[200px] w-full flex-1 cursor-crosshair"
      >
        {candles.length < 2 ? (
          <div className="grid h-full place-items-center text-base text-muted-foreground">Awaiting price history…</div>
        ) : (
          <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
        )}
      </div>
    </div>
  );
}
