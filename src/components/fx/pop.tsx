"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Clean scale-pop on scroll-in — for a line that should snap forward out of
 *  the section. Crisp spring, no blur, no overshoot wobble. */
export function Pop({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: 18 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: "-15% 0px -15% 0px" }}
      transition={{ type: "spring", stiffness: 220, damping: 20, delay }}
    >
      {children}
    </motion.div>
  );
}
