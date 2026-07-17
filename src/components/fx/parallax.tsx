"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

/** Subtle scroll parallax — element drifts as the page scrolls past it. */
export function Parallax({
  children,
  speed = 0.2,
  className,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [speed * -120, speed * 120]);
  return (
    <motion.div ref={ref} style={{ y: reduce ? 0 : y }} className={className}>
      {children}
    </motion.div>
  );
}
