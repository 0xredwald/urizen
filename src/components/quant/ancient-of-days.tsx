"use client";

import { useEffect, useRef } from "react";

// The signature of the studio: Blake's "Ancient of Days" — Urizen leaning from the sun,
// dividing the deep with a compass. Rendered as engraved line-work: a radiant disc, a slow
// sweeping compass, and rays raining into the void. Canvas so the sweep is cheap and smooth;
// honors prefers-reduced-motion (holds a single measured frame).
export function AncientOfDays({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, raf = 0, phase = reduce ? Math.PI * 0.62 : 0, alive = true;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const SIGNAL = "#34F003";

    const draw = () => {
      if (!alive) return;
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H * 0.38;
      const R = Math.min(W, H) * 0.19;

      // ── the void below: raining engraved rays ──
      const rays = 34;
      ctx.lineWidth = 1;
      for (let i = 0; i < rays; i++) {
        const t = i / (rays - 1);
        const x = cx + (t - 0.5) * W * 0.9;
        const spread = (t - 0.5) * W * 0.16;
        const flick = reduce ? 0 : Math.sin(phase * 2 + i * 0.7) * 0.5 + 0.5;
        ctx.globalAlpha = 0.05 + flick * 0.10;
        ctx.strokeStyle = SIGNAL;
        ctx.beginPath();
        ctx.moveTo(cx + spread * 0.2, cy + R * 0.5);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ── the radiant disc (the sun Urizen leans from) ──
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, R * 1.5);
      grad.addColorStop(0, "rgba(52,240,3,0.16)");
      grad.addColorStop(1, "rgba(52,240,3,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // engraved concentric rings
      ctx.strokeStyle = "rgba(242,241,236,0.5)";
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = 0.18 - k * 0.04;
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1 + k * 0.16), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // the disc rim, signal
      ctx.strokeStyle = SIGNAL;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // engraved hatch inside the disc (Blake's cross-hatch)
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R - 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = "rgba(52,240,3,0.22)";
      ctx.lineWidth = 0.6;
      for (let y = -R; y < R; y += 5) {
        ctx.beginPath();
        ctx.moveTo(cx - R, cy + y);
        ctx.lineTo(cx + R, cy + y + R * 0.4);
        ctx.stroke();
      }
      ctx.restore();

      // ── the compass: two legs from the disc measuring the deep ──
      const sweep = reduce ? phase : Math.sin(phase) * 0.5 + 1.15; // radians of opening
      const legLen = R * 2.6;
      const originY = cy + R * 0.2;
      const baseAngle = Math.PI / 2; // pointing down
      const a1 = baseAngle - sweep / 2;
      const a2 = baseAngle + sweep / 2;
      const leg = (ang: number) => {
        const ex = cx + Math.cos(ang) * legLen;
        const ey = originY + Math.sin(ang) * legLen;
        ctx.strokeStyle = SIGNAL;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(cx, originY);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        // the sharp point
        ctx.fillStyle = SIGNAL;
        ctx.beginPath();
        ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
        ctx.fill();
        return [ex, ey] as const;
      };
      const p1 = leg(a1);
      const p2 = leg(a2);
      // the arc the compass scribes between its points
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = "rgba(242,241,236,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, originY, legLen, a1, a2);
      ctx.stroke();
      // the hinge
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#0a0a0b";
      ctx.strokeStyle = SIGNAL;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, originY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      void p1; void p2;

      if (!reduce) {
        phase += 0.006;
        raf = requestAnimationFrame(draw);
      }
    };
    draw();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
