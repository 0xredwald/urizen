"use client";

import { useEffect, useRef } from "react";

/**
 * Streaming equity-curve canvas — a live, upward-drifting line with glow,
 * area fill and a pulsing leading dot. Self-contained Canvas 2D, no deps.
 * Reads as "markets, alive." Respects prefers-reduced-motion.
 */
export function EquityFlow({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const N = 160; // points held in the buffer
    // seed a gently rising random walk (0..1, higher = up)
    const vals: number[] = [];
    let y = 0.34;
    for (let i = 0; i < N; i++) {
      y += (Math.random() - 0.46) * 0.05;
      y = Math.max(0.12, Math.min(0.9, y));
      vals.push(y);
    }

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      w = parent.clientWidth;
      h = parent.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    let raf = 0;
    let t = 0;
    const GREEN = "52,240,3";

    const draw = () => {
      t += 1;
      // advance the walk every few frames
      if (t % 3 === 0) {
        y += (Math.random() - 0.46) * 0.05;
        y = Math.max(0.12, Math.min(0.9, y));
        vals.push(y);
        vals.shift();
      }
      ctx.clearRect(0, 0, w, h);

      const pad = h * 0.12;
      const usable = h - pad * 2;
      const px = (i: number) => (i / (N - 1)) * w;
      const py = (v: number) => h - pad - v * usable;

      // area fill
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < N; i++) ctx.lineTo(px(i), py(vals[i]));
      ctx.lineTo(w, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, py(0.9), 0, h);
      grad.addColorStop(0, `rgba(${GREEN},0.16)`);
      grad.addColorStop(1, `rgba(${GREEN},0)`);
      ctx.fillStyle = grad;
      ctx.fill();

      // line with glow
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const X = px(i);
        const Y = py(vals[i]);
        if (i === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      }
      ctx.shadowBlur = 18;
      ctx.shadowColor = `rgba(${GREEN},0.7)`;
      ctx.strokeStyle = `rgba(${GREEN},0.95)`;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.shadowBlur = 0;

      // leading dot + pulsing halo
      const lx = px(N - 1);
      const ly = py(vals[N - 1]);
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.08);
      ctx.beginPath();
      ctx.arc(lx, ly, 3 + pulse * 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${GREEN},${0.18 * (1 - pulse * 0.5)})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${GREEN})`;
      ctx.fill();

      if (!reduce) raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
