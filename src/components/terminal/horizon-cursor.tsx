"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "motion/react";

// The visible Horizon cursor. A fixed, pointer-events-none pointer that the action dispatcher moves
// around the terminal so you watch the agent work. Motion springs make the moves smooth and awaitable
// (each returns a promise), press() fires a ripple. Honors prefers-reduced-motion via short springs.

export type CursorHandle = {
  show: (label?: string) => void;
  hide: () => void;
  setLabel: (s: string) => void;
  moveTo: (x: number, y: number, slow?: boolean) => Promise<void>;
  press: () => Promise<void>;
};

export const HorizonCursor = forwardRef<CursorHandle>(function HorizonCursor(_props, ref) {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState("Agent");
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const rid = useRef(0);

  useImperativeHandle(ref, (): CursorHandle => ({
    show: (l) => { if (l) setLabel(l); setVisible(true); },
    hide: () => setVisible(false),
    setLabel,
    moveTo: async (tx, ty, slow = false) => {
      const opts = slow
        ? { type: "spring" as const, stiffness: 55, damping: 22, mass: 1 }
        : { type: "spring" as const, stiffness: 130, damping: 20, mass: 0.7 };
      const a = animate(x, tx, opts);
      const b = animate(y, ty, opts);
      await Promise.all([a.finished, b.finished]);
    },
    press: async () => {
      const id = ++rid.current;
      setRipples((r) => [...r, { id, x: x.get(), y: y.get() }]);
      setTimeout(() => setRipples((r) => r.filter((p) => p.id !== id)), 650);
      await new Promise((r) => setTimeout(r, 160));
    },
  }), [x, y]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      {/* ripples */}
      {ripples.map((p) => (
        <motion.span key={p.id} initial={{ opacity: 0.5, scale: 0 }} animate={{ opacity: 0, scale: 1 }} transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute rounded-full border border-signal" style={{ left: p.x - 18, top: p.y - 18, width: 36, height: 36 }} />
      ))}
      {/* the pointer */}
      <motion.div style={{ x, y, opacity: visible ? 1 : 0 }} transition={{ opacity: { duration: 0.25 } }} className="absolute left-0 top-0">
        <svg viewBox="0 0 16 16" className="h-5 w-5 drop-shadow-[0_0_6px_rgba(52,240,3,0.7)]" style={{ transform: "translate(-2px,-2px)" }}>
          <path d="M2 1.5 13.5 8 8 9.2 6.4 14 2 1.5Z" fill="#34F003" stroke="#04140a" strokeWidth="0.8" strokeLinejoin="round" />
        </svg>
        <span className="absolute left-4 top-4 whitespace-nowrap rounded-full bg-signal px-2 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-widest text-[#04140a] shadow-lg">{label}</span>
      </motion.div>
    </div>
  );
});
