"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** Clean per-letter clip-reveal (rises into a mask). No scramble. */
export function WordReveal({
  text,
  className,
  delay = 0,
  stagger = 0.06,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  const letters = text.split("");
  return (
    <span className={cn("inline-flex", className)} aria-label={text}>
      {letters.map((ch, i) => (
        <span key={i} className="overflow-hidden" style={{ display: "inline-block" }}>
          <motion.span
            style={{ display: "inline-block" }}
            initial={reduce ? { opacity: 0 } : { y: "110%" }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: 0.8,
              delay: delay + i * stagger,
              ease: [0.16, 1, 0.3, 1],
            }}
            aria-hidden
          >
            {ch === " " ? " " : ch}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
