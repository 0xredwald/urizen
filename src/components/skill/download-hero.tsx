"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

const REPO = "https://github.com/CTRLabs/urizen-skill";

/** Full-bleed download hero — Blake's "Ancient of Days" as a neon-green duotone
 *  that drifts (ken-burns) and leans toward the cursor (parallax). One download
 *  button in the middle; repo + description small beneath. */
export function DownloadHero() {
  const plateRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const cur = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = plateRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const tick = () => {
      cur.current.x += (target.current.x - cur.current.x) * 0.06;
      cur.current.y += (target.current.y - cur.current.y) * 0.06;
      el.style.transform = `scale(1.12) translate3d(${cur.current.x * 22}px, ${cur.current.y * 22}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onMove = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    target.current = {
      x: (e.clientX - r.left) / r.width - 0.5,
      y: (e.clientY - r.top) / r.height - 0.5,
    };
  };
  const onLeave = () => { target.current = { x: 0, y: 0 }; };

  return (
    <section
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative flex min-h-[calc(100svh-1px)] items-center justify-center overflow-hidden px-6"
    >
      {/* Blake plate — parallax + ken-burns */}
      <div ref={plateRef} className="absolute inset-0 will-change-transform" style={{ transform: "scale(1.12)" }}>
        <Image
          src="/img/blake-ancient.webp"
          alt="William Blake — The Ancient of Days"
          fill
          priority
          sizes="100vw"
          className="anim-kenburns object-cover object-top grayscale contrast-[1.15] brightness-[0.95]"
        />
      </div>
      {/* neon-green duotone */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "var(--signal)", mixBlendMode: "multiply" }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(52,240,3,0.10)", mixBlendMode: "screen" }} />
      {/* grain + scanlines + vignette */}
      <div className="scanlines pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "url(/img/noise.svg)", opacity: 0.06 }} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 42%, transparent 30%, rgba(10,10,11,0.86) 100%)" }}
      />

      {/* content */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <span className="font-mono text-[0.72rem] uppercase tracking-[0.32em] text-signal">Urizen · Skill</span>
        <h1 className="display-tight mt-6 text-[clamp(2.6rem,9vw,6rem)] leading-[0.92] text-foreground">
          The fund,
          <br />
          <span className="text-signal">as a skill.</span>
        </h1>

        <a
          href="/SKILL.md"
          download="SKILL.md"
          className="group relative mt-12 inline-flex items-center gap-3 overflow-hidden border border-signal bg-signal/[0.06] px-9 py-5 font-mono text-base uppercase tracking-[0.18em] text-signal transition-colors duration-300 hover:text-background"
        >
          <span className="absolute inset-0 -z-0 origin-left scale-x-0 bg-signal transition-transform duration-300 ease-out group-hover:scale-x-100" />
          <span className="relative z-10">Download SKILL.md</span>
          <svg viewBox="0 0 24 24" className="relative z-10 h-5 w-5 transition-transform duration-300 group-hover:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v13m0 0l-5-5m5 5l5-5M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        <div className="mt-8 flex flex-col items-center gap-2 font-mono text-[0.75rem] text-muted-foreground">
          <a href={REPO} target="_blank" rel="noopener noreferrer" className="tracking-[0.1em] transition-colors hover:text-signal">
            github.com/CTRLabs/urizen-skill ↗
          </a>
          <p className="max-w-md leading-relaxed tracking-[0.02em]">
            Read the fund&apos;s strategies and book, copy-trade its allocation, or take
            one-token exposure via $URI. Public, key-less, on Robinhood Chain.
          </p>
        </div>
      </div>
    </section>
  );
}
