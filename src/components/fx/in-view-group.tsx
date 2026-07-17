"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Wraps a subtree and only lets its CSS animations run once it scrolls into
 *  view (via the `.gate` class, which holds animation-play-state paused until
 *  data-in is true). */
export function InViewGroup({
  children,
  className,
  threshold = 0.35,
}: {
  children: React.ReactNode;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return (
    <div ref={ref} data-in={inView} className={cn("gate", className)}>
      {children}
    </div>
  );
}
