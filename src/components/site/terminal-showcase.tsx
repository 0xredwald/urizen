"use client";

// The homepage centerpiece — a faithful mini of the real terminal in 3D. It fades up on load, tilts
// smoothly toward the cursor on hover (damped spring, no popping), and plays a clean scripted loop:
// the user asks the URIZEN agent, and it draws ONE solid trendline, holds it, then proposes a trade.
// Entrance (fade/rise) and tilt (rotate) live on SEPARATE layers so their transforms never fight.

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { UrizenMark } from "@/components/brand/marks";

type Row = { s: string; p: number; c: number; on?: boolean };

const SEED: Row[] = [
  { s: "NVDA", p: 208.4, c: +1.2, on: true }, { s: "AAPL", p: 241.1, c: +0.8 }, { s: "MSFT", p: 471.3, c: +0.7 },
  { s: "META", p: 628.9, c: +1.1 }, { s: "TSLA", p: 402.1, c: -1.2 }, { s: "COIN", p: 312.8, c: +3.7 },
  { s: "AMD", p: 178.2, c: +1.9 }, { s: "PLTR", p: 131.1, c: +4.2 }, { s: "GOOGL", p: 196.3, c: -0.5 },
  { s: "AMZN", p: 232.6, c: +0.3 }, { s: "SPY", p: 601.2, c: +0.4 }, { s: "QQQ", p: 528.7, c: +0.6 },
];
const SEED_SERIES = [188, 191, 189, 194, 192, 197, 195, 201, 199, 203, 200, 205, 204, 207, 206, 208.4];

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct1 = (c: number) => `${c >= 0 ? "+" : ""}${c.toFixed(1)}%`;
const EASE = [0.16, 0.86, 0.3, 1] as const;

function useLiveDemo() {
  const [rows, setRows] = useState<Row[]>(SEED);
  const [series, setSeries] = useState<number[]>(SEED_SERIES);
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const d = await fetch("/api/quant/movers", { cache: "no-store" }).then((r) => r.json());
        const all: { symbol: string; price: number; changePct: number }[] = Array.isArray(d?.all) ? d.all : [];
        const map = new Map(all.map((q) => [q.symbol, q]));
        if (on && all.length) setRows((prev) => prev.map((row) => {
          const q = map.get(row.s);
          if (q && q.price > 0 && q.price >= row.p * 0.5 && q.price <= row.p * 2) {
            const c = Number.isFinite(q.changePct) && Math.abs(q.changePct) <= 12 ? q.changePct : row.c;
            return { ...row, p: q.price, c };
          }
          return row;
        }));
      } catch { /* keep seed */ }
      try {
        const d = await fetch("/api/quant/ohlc?symbol=NVDA&interval=1h", { cache: "no-store" }).then((r) => r.json());
        const closes: number[] = Array.isArray(d?.candles) ? d.candles.map((k: { c: number }) => k.c).filter((x: number) => Number.isFinite(x)) : [];
        if (on && closes.length >= 8) setSeries(closes.slice(-48));
      } catch { /* keep seed */ }
    })();
    return () => { on = false; };
  }, []);
  const nvda = rows.find((r) => r.s === "NVDA") ?? SEED[0];
  return { rows, series, nvda };
}

function chartPaths(series: number[]) {
  const W = 320, H = 150, n = series.length;
  const max = Math.max(...series), min = Math.min(...series), span = max - min || 1;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - ((v - min) / span) * (H - 14) - 7;
  const line = series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return { W, H, line, area: `${line} L${W},${H} L0,${H} Z`, x, y };
}

// pick two REAL pivots for an accurate uptrend line: the low in the first half, then the high after it.
// Returned in 0–100 overlay space so the trendline + cursor land exactly on those points on the chart.
function trendPivots(series: number[], x: (i: number) => number, y: (v: number) => number, W: number, H: number) {
  const n = series.length;
  const lowEnd = Math.max(3, Math.floor(n * 0.5));
  let lo = 0; for (let i = 1; i < lowEnd; i++) if (series[i] < series[lo]) lo = i;
  let hi = Math.min(lo + 1, n - 1); for (let i = lo + 2; i < n; i++) if (series[i] > series[hi]) hi = i;
  return {
    p1: { x: (x(lo) / W) * 100, y: (y(series[lo]) / H) * 100 },
    p2: { x: (x(hi) / W) * 100, y: (y(series[hi]) / H) * 100 },
  };
}

// the scripted loop — one clean beat at a time
function useSequence(steps: number, ms: number) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    let s = 0;
    const id = setInterval(() => { s = (s + 1) % steps; setStep(s); }, ms);
    return () => clearInterval(id);
  }, [steps, ms]);
  return step;
}

function Ticker({ rows }: { rows: Row[] }) {
  return (
    <div className="flex w-max items-stretch tape-track">
      {[0, 1].map((k) => (
        <div key={k} className="flex items-stretch">
          {rows.map((t, i) => (
            <span key={`${k}-${i}`} className="inline-flex shrink-0 items-baseline gap-1.5 border-r border-white/[0.06] px-2.5 py-1">
              <span className="font-mono text-[8px] font-semibold text-white/80">{t.s}</span>
              <span className="font-mono text-[8px] tabular-nums text-white/55">{fmt(t.p)}</span>
              <span className={`font-mono text-[7.5px] tabular-nums ${t.c >= 0 ? "text-signal" : "text-[#ff5a5a]"}`}>{t.c >= 0 ? "▲" : "▼"}{Math.abs(t.c).toFixed(1)}%</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Field({ label, amt, tok }: { label: string; amt: string; tok: string }) {
  return (
    <div className="border border-white/10 bg-[#0b0b0d] px-1.5 py-1">
      <div className="font-mono text-[5.5px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[11px] font-semibold tabular-nums text-white">{amt}</span>
        <span className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[6.5px] text-white/85">{tok}</span>
      </div>
    </div>
  );
}

export function TerminalShowcase() {
  const { rows, series, nvda } = useLiveDemo();
  const { W, H, line, area, x, y } = chartPaths(series);
  const { p1, p2 } = trendPivots(series, x, y, W, H);
  const watch = rows.slice(0, 7);
  const recv = nvda.p > 0 ? (100 / nvda.p).toFixed(3) : "0.481";
  const support = fmt(nvda.p * 0.94);

  const step = useSequence(9, 1500);
  // the cursor rides the REAL pivots: down to the low, then up to the high (drawing the line), then rests
  const cur = step === 2 ? { ...p1, on: true } : step >= 3 && step <= 5 ? { ...p2, on: true } : { ...p1, on: false };
  const trendShow = step >= 2;
  const trendOn = step >= 3;
  const proposal = step >= 6;
  const buyPulse = proposal;

  const SCRIPT: { at: number; role: "user" | "agent"; text: string }[] = [
    { at: 1, role: "user", text: "draw the trend on NVDA" },
    { at: 4, role: "agent", text: `Uptrend intact — support at $${support}.` },
    { at: 5, role: "user", text: "set up a buy" },
  ];
  const msgs = SCRIPT.filter((m) => step >= m.at).slice(-3);

  // smooth 3D hover — damped springs, base tilt at rest, gentle parallax toward the cursor
  const wrapRef = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  // damped springs → smooth, never poppy. Base tilt at rest + a few degrees of parallax on hover.
  const rotY = useSpring(useTransform(px, [-0.5, 0.5], [-17, -8]), { stiffness: 55, damping: 24, mass: 1 });
  const rotX = useSpring(useTransform(py, [-0.5, 0.5], [12, 4]), { stiffness: 55, damping: 24, mass: 1 });
  const onMove = (e: React.MouseEvent) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { px.set(0); py.set(0); };

  return (
    <div ref={wrapRef} onMouseMove={onMove} onMouseLeave={onLeave} className="relative mx-auto w-full max-w-[660px]" style={{ perspective: "1900px" }}>
      <div aria-hidden className="pointer-events-none absolute -inset-10 -z-10"
        style={{ background: "radial-gradient(58% 58% at 55% 42%, rgba(52,240,3,0.13), transparent 72%)" }} />

      {/* ENTRANCE layer — fade + rise on load (no rotate here, so it never fights the tilt) */}
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.05, ease: EASE }}>
        {/* TILT layer — smooth damped 3D on hover */}
        <motion.div style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
          className="overflow-hidden rounded-[8px] border border-white/12 bg-[#0a0a0b] shadow-[0_44px_100px_-34px_rgba(0,0,0,0.9),0_0_0_1px_rgba(52,240,3,0.05)]">
          {/* top bar */}
          <div className="flex h-8 items-center gap-2 border-b border-white/10 px-3">
            <span className="grid h-5 w-5 place-items-center rounded-[4px] bg-signal/15"><UrizenMark className="h-3 w-auto text-signal" /></span>
            <span className="font-mono text-[10px] font-bold tracking-tight text-white">Terminal</span>
            <span className="hidden rounded-full border border-white/15 px-1.5 py-0.5 font-mono text-[6.5px] uppercase tracking-[0.2em] text-white/50 sm:inline">Urizen</span>
          </div>
          {/* tape */}
          <div className="relative h-5 overflow-hidden border-b border-white/10">
            <Ticker rows={rows} />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#0a0a0b] to-transparent" />
          </div>
          {/* three rails — swap+markets · chart · chat — lifted to different depths for real 3D */}
          <div className="grid gap-1.5 p-1.5" style={{ gridTemplateColumns: "108px 1fr 150px", transformStyle: "preserve-3d" }}>
            {/* LEFT: swap + markets — pushed back */}
            <div className="flex min-w-0 flex-col gap-1.5" style={{ transform: "translateZ(-8px)" }}>
              <motion.div animate={buyPulse ? { boxShadow: "0 0 0 1px rgba(52,240,3,0.6), 0 12px 30px -14px rgba(52,240,3,0.7)" } : { boxShadow: "0 10px 26px -18px rgba(52,240,3,0.5)" }}
                className="rounded-[5px] border border-signal/30 bg-[#0d0d0f] p-1.5">
                <div className="mb-1 font-mono text-[6.5px] font-semibold uppercase tracking-widest text-signal">Swap</div>
                <Field label="Pay" amt="100" tok="USDG" />
                <div className="my-1"><Field label="Receive" amt={recv} tok="NVDA" /></div>
                <div className={`py-1 text-center font-mono text-[7px] font-semibold uppercase tracking-wide transition-colors ${buyPulse ? "bg-white text-[#04140a]" : "bg-signal text-[#04140a]"}`}>Buy NVDA</div>
              </motion.div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-[5px] border border-white/10 bg-[#0b0b0d]">
                <div className="border-b border-white/10 px-1.5 py-1 font-mono text-[6.5px] uppercase tracking-widest text-white/40">Markets</div>
                <div className="divide-y divide-white/[0.05]">
                  {watch.map((w) => (
                    <div key={w.s} className={`flex items-center justify-between px-1.5 py-[3px] ${w.on ? "bg-signal/10" : ""}`}>
                      <span className={`font-mono text-[7.5px] ${w.on ? "text-signal" : "text-white/85"}`}>{w.s}</span>
                      <span className={`font-mono text-[7px] tabular-nums ${w.c >= 0 ? "text-signal" : "text-[#ff5a5a]"}`}>{pct1(w.c)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CENTER: chart with the agent cursor drawing a SOLID trendline — floated forward */}
            <div className="flex min-h-0 flex-col overflow-hidden rounded-[6px] border border-signal/25 bg-[#0b0b0d] shadow-[0_18px_44px_-16px_rgba(52,240,3,0.35)]"
              style={{ transform: "translateZ(34px)" }}>
              <div className="flex items-center gap-2 border-b border-white/10 px-2.5 py-1.5">
                <span className="grid h-4 w-4 place-items-center rounded-[3px] bg-signal/15 font-mono text-[7px] font-bold text-signal">N</span>
                <span className="font-mono text-[9px] font-semibold text-white/90">NVDA</span>
                <span className="font-mono text-[8px] text-white/45">NVIDIA</span>
                <span className="ml-1 font-mono text-[10px] font-semibold tabular-nums text-white">${fmt(nvda.p)}</span>
                <span className={`font-mono text-[8px] tabular-nums ${nvda.c >= 0 ? "text-signal" : "text-[#ff5a5a]"}`}>{nvda.c >= 0 ? "▲" : "▼"} {Math.abs(nvda.c).toFixed(2)}%</span>
              </div>
              <div className="relative min-h-[190px] flex-1">
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                  <defs>
                    <linearGradient id="tsc-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34F003" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#34F003" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" y1={H * g} x2={W} y2={H * g} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />)}
                  <path d={area} fill="url(#tsc-fill)" />
                  <path d={line} fill="none" stroke="#34F003" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
                </svg>
                {/* the trendline the agent draws — a SOLID line grown from its endpoint (x2/y2), so it's
                    always one continuous stroke, never dashed/segmented */}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                  <motion.line x1={p1.x} y1={p1.y} stroke="#f2fff6" strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                    initial={{ x2: p1.x, y2: p1.y, opacity: 0 }}
                    animate={{ x2: trendOn ? p2.x : p1.x, y2: trendOn ? p2.y : p1.y, opacity: trendShow ? 1 : 0 }}
                    transition={{ x2: { duration: 1.2, ease: EASE }, y2: { duration: 1.2, ease: EASE }, opacity: { duration: 0.3 } }} />
                </svg>
                {/* the cursor — labelled "agent" */}
                <motion.div className="pointer-events-none absolute" initial={false}
                  animate={{ left: `${cur.x}%`, top: `${cur.y}%`, opacity: cur.on ? 1 : 0 }}
                  transition={{ left: { duration: 1.2, ease: EASE }, top: { duration: 1.2, ease: EASE }, opacity: { duration: 0.35 } }}>
                  <div className="relative -translate-x-[1px] -translate-y-[1px]">
                    <svg width="15" height="20" viewBox="0 0 15 20" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"><path d="M0,0 L0,15 L4,11 L7,17.5 L9.3,16.5 L6.4,10 L11.5,10 Z" fill="#34F003" stroke="#04140a" strokeWidth="0.5" strokeLinejoin="round" /></svg>
                    <span className="absolute left-3.5 top-3 rounded-[2px] bg-signal px-1 py-0.5 font-mono text-[7px] font-bold uppercase tracking-wide text-[#04140a]">agent</span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* RIGHT: the URIZEN agent chat, full height — pushed back */}
            <div className="flex min-h-0 flex-col overflow-hidden rounded-[5px] border border-white/10 bg-[#0b0b0d]" style={{ transform: "translateZ(-8px)" }}>
              <div className="flex items-center gap-1.5 border-b border-white/10 px-2 py-1.5">
                <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-signal/40 bg-signal/10"><UrizenMark className="h-2 w-auto text-signal" /></span>
                <span className="font-mono text-[7px] font-semibold uppercase tracking-widest text-signal">Urizen</span>
                <span className="font-mono text-[6.5px] uppercase tracking-widest text-white/40">agent</span>
              </div>
              <div className="flex flex-1 flex-col justify-end gap-1.5 overflow-hidden p-1.5">
                {msgs.map((m, i) => (
                  <motion.div key={`${step}-${i}-${m.at}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}
                    className={m.role === "user"
                      ? "ml-auto w-max max-w-[90%] rounded bg-signal/15 px-1.5 py-1 font-mono text-[7px] leading-tight text-white/90"
                      : "w-max max-w-[96%] rounded bg-white/[0.06] px-1.5 py-1 font-mono text-[7px] leading-snug text-white/75"}>
                    {m.text}
                  </motion.div>
                ))}
                {proposal && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
                    className="rounded-[4px] border border-signal/50 bg-signal/[0.08] p-1.5">
                    <div className="mb-1 font-mono text-[6px] font-semibold uppercase tracking-widest text-signal">⚡ Trade proposal</div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[8px] font-semibold text-white/90">Buy NVDA</span>
                      <span className="font-mono text-[8px] tabular-nums text-white/70">$100</span>
                    </div>
                    <div className="mt-1 bg-signal py-0.5 text-center font-mono text-[6px] font-semibold uppercase tracking-wide text-[#04140a]">Sign in wallet</div>
                  </motion.div>
                )}
              </div>
              <div className="border-t border-white/10 p-1.5">
                <div className="flex items-center gap-1 rounded border border-white/10 bg-[#0b0b0d] px-1.5 py-1 font-mono text-[6.5px] text-white/35">ask the desk…</div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
