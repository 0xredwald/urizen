"use client";

import { useEffect, useRef } from "react";

/** Analog-TV snow revealed inside a soft spotlight that follows the cursor.
 *  Low-res grayscale noise (no WebGL), throttled fps, masked to a circle so the
 *  rest of the poster stays clean. The mask follows the pointer with easing. */
export function TVSnow({
  className,
  fps = 14,
  opacity = 0.7,
  radius = 240,
}: {
  className?: string;
  fps?: number;
  opacity?: number;
  radius?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 240;
    const H = 135;
    canvas.width = W;
    canvas.height = H;
    const img = ctx.createImageData(W, H);
    const data = img.data;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const interval = 1000 / fps;
    let rafSnow = 0;
    let last = 0;

    const paint = () => {
      for (let i = 0; i < data.length; i += 4) {
        const v = 90 + ((Math.random() * 165) | 0);
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };

    if (reduce) paint();
    else {
      const loop = (t: number) => {
        rafSnow = requestAnimationFrame(loop);
        if (t - last < interval) return;
        last = t;
        paint();
      };
      rafSnow = requestAnimationFrame(loop);
    }

    // --- cursor spotlight mask (eased) ---
    const parent = canvas.parentElement;
    const target = { x: 0.5, y: 0.38 };
    const cur = { x: 0.5, y: 0.38 };
    let rafMask = 0;
    let active = false;

    const setMask = () => {
      const mx = (cur.x * 100).toFixed(2);
      const my = (cur.y * 100).toFixed(2);
      const mask = `radial-gradient(circle ${radius}px at ${mx}% ${my}%, #000 0%, #000 22%, rgba(0,0,0,0.35) 55%, transparent 74%)`;
      canvas.style.maskImage = mask;
      canvas.style.webkitMaskImage = mask;
    };
    setMask();

    const ease = () => {
      cur.x += (target.x - cur.x) * 0.12;
      cur.y += (target.y - cur.y) * 0.12;
      setMask();
      if (Math.abs(target.x - cur.x) > 0.001 || Math.abs(target.y - cur.y) > 0.001) {
        rafMask = requestAnimationFrame(ease);
      } else {
        active = false;
      }
    };
    const kick = () => {
      if (!active) {
        active = true;
        rafMask = requestAnimationFrame(ease);
      }
    };
    const onMove = (e: PointerEvent) => {
      const host = parent ?? canvas;
      const r = host.getBoundingClientRect();
      target.x = (e.clientX - r.left) / r.width;
      target.y = (e.clientY - r.top) / r.height;
      kick();
    };
    const onLeave = () => {
      target.x = 0.5;
      target.y = 0.38;
      kick();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    (parent ?? canvas).addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(rafSnow);
      cancelAnimationFrame(rafMask);
      window.removeEventListener("pointermove", onMove);
      (parent ?? canvas).removeEventListener("pointerleave", onLeave);
    };
  }, [fps, radius]);

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden
      style={{
        width: "100%",
        height: "100%",
        opacity,
        mixBlendMode: "soft-light",
        filter: "blur(0.8px) contrast(1.2)",
      }}
    />
  );
}
