"use client";

import { useEffect, useRef, type ComponentType } from "react";
import { UrizenMark } from "@/components/brand/marks";
import { NvidiaIcon, AppleIcon, TeslaIcon } from "@/components/brand/stock-logos";

type Card = { action: string; ticker: string; Logo?: ComponentType<{ className?: string }>; urizen?: boolean };

// a fixed pool of cards that ride the stream and recycle — decorative only,
// they never re-mount (positioned purely via refs for a smooth ride).
const CARDS: Card[] = [
  { action: "Bought", ticker: "NVDA", Logo: NvidiaIcon },
  { action: "Bought", ticker: "AAPL", Logo: AppleIcon },
  { action: "Bought back", ticker: "$URI", urizen: true },
  { action: "Bought", ticker: "TSLA", Logo: TeslaIcon },
];

const VIS = 26; // visible points across the width
const NP = VIS + 3; // + guard points past each edge so the line never gaps
const RECYCLE = NP; // world index a card returns to after leaving the left

export function HeroChart({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let step = 0;
    const resize = () => {
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      step = W / (VIS - 1);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const ys: number[] = [];
    let level = 0.3;
    for (let i = 0; i < NP; i++) {
      level = Math.max(0.16, Math.min(0.9, level + (Math.random() - 0.5) * 0.07 + 0.006));
      ys.push(level);
    }

    const world = CARDS.map((_, k) => 4 + k * ((RECYCLE + 2) / CARDS.length));

    const yPx = (v: number) => H - v * (H * 0.56) - H * 0.1;
    const xPx = (i: number, frac: number) => (i - 1 - frac) * step;

    const trace = (frac: number, close: boolean) => {
      ctx.beginPath();
      if (close) ctx.moveTo(xPx(0, frac), H);
      ctx.lineTo(xPx(0, frac), yPx(ys[0]));
      for (let i = 0; i < NP - 1; i++) {
        const a = i - 1 < 0 ? 0 : i - 1;
        const b = i + 2 > NP - 1 ? NP - 1 : i + 2;
        const x0 = xPx(a, frac), y0 = yPx(ys[a]);
        const x1 = xPx(i, frac), y1 = yPx(ys[i]);
        const x2 = xPx(i + 1, frac), y2 = yPx(ys[i + 1]);
        const x3 = xPx(b, frac), y3 = yPx(ys[b]);
        ctx.bezierCurveTo(x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6, x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6, x2, y2);
      }
      if (close) {
        ctx.lineTo(xPx(NP - 1, frac), H);
        ctx.closePath();
      }
    };

    const sampleY = (idx: number) => {
      const i = Math.max(0, Math.min(NP - 2, Math.floor(idx)));
      const t = Math.max(0, Math.min(1, idx - i));
      return yPx(ys[i] * (1 - t) + ys[i + 1] * t);
    };

    let frac = 0;
    let raf = 0;
    const SPEED = reduce ? 0 : 0.02;

    const render = () => {
      frac += SPEED;
      while (frac >= 1) {
        frac -= 1;
        ys.shift();
        level = Math.max(0.16, Math.min(0.9, ys[ys.length - 1] + (Math.random() - 0.5) * 0.08 + 0.006));
        ys.push(level);
        for (let k = 0; k < world.length; k++) {
          world[k] -= 1;
          if (world[k] < -2) world[k] += RECYCLE + 4;
        }
      }

      ctx.clearRect(0, 0, W, H);
      trace(frac, true);
      const g = ctx.createLinearGradient(0, yPx(0.92), 0, H);
      g.addColorStop(0, "rgba(52,240,3,0.16)");
      g.addColorStop(1, "rgba(52,240,3,0)");
      ctx.fillStyle = g;
      ctx.fill();
      trace(frac, false);
      ctx.shadowBlur = 14;
      ctx.shadowColor = "rgba(52,240,3,0.6)";
      ctx.strokeStyle = "#34F003";
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.shadowBlur = 0;

      for (let k = 0; k < world.length; k++) {
        const el = cardRefs.current[k];
        if (!el) continue;
        const sx = xPx(world[k], frac);
        el.style.transform = `translate(${sx}px, ${sampleY(world[k])}px) translate(-50%, -100%)`;
        el.style.opacity = String(Math.max(0, Math.min(1, (W - sx) / 150, (sx + 30) / 130)));
      }

      if (!reduce) raf = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <canvas ref={canvasRef} className="absolute inset-0" aria-hidden />
      {CARDS.map((c, k) => (
        <div
          key={k}
          ref={(el) => {
            cardRefs.current[k] = el;
          }}
          className="absolute left-0 top-0 flex max-w-[92vw] flex-col items-center will-change-transform"
          style={{ opacity: 0 }}
        >
          <div className="flex items-center gap-2 whitespace-nowrap border border-signal/40 bg-background/90 px-3 py-2 shadow-[0_8px_30px_-10px_rgba(52,240,3,0.35)] backdrop-blur-md sm:gap-2.5 sm:px-4 sm:py-2.5">
            <UrizenMark className="h-3.5 w-auto text-signal sm:h-4" />
            <span className="font-display text-xs font-bold uppercase tracking-tight text-foreground sm:text-sm">Urizen</span>
            <span className="hidden font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground sm:inline">{c.action}</span>
            <span className="mx-0.5 h-4 w-px bg-white/15" />
            {c.urizen ? <UrizenMark className="h-3.5 w-auto text-signal sm:h-4" /> : c.Logo && <c.Logo className="size-3.5 text-signal sm:size-4" />}
            <span className="font-mono text-xs font-semibold text-signal sm:text-sm">{c.ticker}</span>
          </div>
          <span className="h-6 w-px bg-signal/45" />
        </div>
      ))}
    </div>
  );
}
