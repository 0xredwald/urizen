"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789/\\<>#*+=-—";

/** Cypherpunk decrypt-scramble that resolves to the target text when in view. */
export function DecryptText({
  text,
  className,
  speed = 28,
  startDelay = 0,
}: {
  text: string;
  className?: string;
  speed?: number;
  startDelay?: number;
}) {
  const [display, setDisplay] = useState(text);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(text);
      return;
    }

    let raf = 0;
    let revealed = 0;
    let tick = 0;

    const run = () => {
      const out = text
        .split("")
        .map((ch, i) => {
          if (ch === " ") return " ";
          if (i < revealed) return ch;
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        })
        .join("");
      setDisplay(out);
      tick++;
      if (tick % 2 === 0) revealed += 1;
      if (revealed <= text.length) {
        raf = requestAnimationFrame(() => setTimeout(run, speed));
      } else {
        setDisplay(text);
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          setTimeout(run, startDelay);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [text, speed, startDelay]);

  return (
    <span ref={ref} className={cn(className)} aria-label={text}>
      <span aria-hidden>{display}</span>
    </span>
  );
}
