"use client";

import { useEffect, useRef, useState } from "react";

type Line = { tag: string; text: string };

const SCRIPT: Line[] = [
  { tag: "boot", text: "urizen fund · connected to Robinhood Chain" },
  { tag: "screen", text: "screening tokenized equities · RWAs · crypto" },
  { tag: "signal", text: "target weights computed · NVDAx +1.8%" },
  { tag: "risk", text: "per-position cap 0.8% of NAV · within bounds" },
  { tag: "exec", text: "allocate → routed onchain" },
  { tag: "fill", text: "filled · position updated · tx 0x9f…c41a" },
  { tag: "guard", text: "settlement = onchain · every fill public" },
  { tag: "pnl", text: "marking book · performance streamed onchain" },
  { tag: "buyback", text: "fees + gains → $URI buyback queued" },
  { tag: "report", text: "publishing positions to the dashboard" },
  { tag: "idle", text: "targets met · monitoring · re-check in 30s" },
];

const TAG_COLOR: Record<string, string> = {
  boot: "text-muted-foreground",
  scan: "text-foreground",
  signal: "text-signal",
  risk: "text-muted-foreground",
  exec: "text-signal",
  fill: "text-foreground",
  guard: "text-muted-foreground",
  pnl: "text-foreground",
  buyback: "text-signal",
  report: "text-foreground",
  idle: "text-muted-foreground",
};

export function AgentTerminal() {
  const [lines, setLines] = useState<{ tag: string; text: string }[]>([]);
  const [typing, setTyping] = useState("");
  const idx = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timers: ReturnType<typeof setTimeout>[] = [];

    const nextLine = () => {
      const line = SCRIPT[idx.current % SCRIPT.length];
      idx.current++;
      if (reduce) {
        setLines((p) => [...p.slice(-7), line]);
        timers.push(setTimeout(nextLine, 1200));
        return;
      }
      let i = 0;
      const typeChar = () => {
        setTyping(line.text.slice(0, i));
        i++;
        if (i <= line.text.length) {
          timers.push(setTimeout(typeChar, 16 + Math.random() * 22));
        } else {
          setLines((p) => [...p.slice(-7), line]);
          setTyping("");
          timers.push(setTimeout(nextLine, 750));
        }
      };
      // current typing line uses a temp marker
      setLines((p) => [...p.slice(-7), { tag: line.tag, text: "" }]);
      typeChar();
    };

    timers.push(setTimeout(nextLine, 400));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, typing]);

  return (
    <div className="flex h-full flex-col border border-border bg-[#0b0b0d]">
      {/* title bar */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full border border-border" />
          <span className="size-2.5 rounded-full border border-border" />
          <span className="size-2.5 rounded-full bg-signal" />
          <span className="ml-2 font-mono text-[0.78rem] uppercase tracking-[0.14em] text-muted-foreground">
            urizen-agent · activity
          </span>
        </div>
      </div>

      {/* log */}
      <div
        ref={scrollRef}
        className="scanlines relative h-80 overflow-hidden px-5 py-5 font-mono text-[0.82rem] leading-[1.7] sm:h-[26rem] sm:text-[0.9rem]"
      >
        {lines.map((l, i) => {
          const isLast = i === lines.length - 1;
          const text = isLast && typing ? typing : l.text;
          return (
            <div key={i} className="flex gap-2">
              <span className="shrink-0 text-muted-foreground/70">
                [{l.tag}]
              </span>
              <span className={TAG_COLOR[l.tag] ?? "text-foreground"}>
                {text}
                {isLast && (
                  <span className="anim-caret ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-signal" />
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* footer note — honest */}
      <div className="flex items-center gap-2 border-t border-border px-5 py-2.5 font-mono text-[0.74rem] uppercase tracking-[0.12em] text-muted-foreground">
        <span className="size-1 rounded-full bg-signal" />
        Illustrative stream · onchain feed connects at launch
      </div>
    </div>
  );
}
