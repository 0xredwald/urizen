"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { pct } from "@/lib/format";

export type Point = { t: number; v: number };

// ---------------------------------------------------------------------------
// Panel — shared card frame with clipped corner (smoothui "clip corners")
// ---------------------------------------------------------------------------
export function Panel({
  title,
  eyebrow,
  right,
  children,
  className,
}: {
  title?: string;
  eyebrow?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-[3px] border border-white/[0.08] bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl ${className ?? ""}`}
    >
      {(title || eyebrow || right) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-7">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && (
              <p className="mt-2 font-display text-xl font-bold uppercase tracking-tight">
                {title}
              </p>
            )}
          </div>
          {right}
        </div>
      )}
      <div className="p-5 sm:p-7">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline (kibo/shadcnblocks stat-card sparkline column)
// ---------------------------------------------------------------------------
export function Sparkline({ data, up = true }: { data: number[]; up?: boolean }) {
  const path = useMemo(() => {
    const W = 100;
    const H = 28;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const y = (v: number) => H - ((v - min) / (max - min || 1)) * H;
    return data
      .map((v, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" L");
  }, [data]);
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full">
      <path
        d={`M${path}`}
        fill="none"
        stroke={up ? "#34F003" : "var(--muted-foreground)"}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// StatCard — KPI with count-up (shadcnstudio Statistics + smoothui ticker)
// ---------------------------------------------------------------------------
export function StatCard({
  label,
  value,
  delta,
  spark,
  accent,
}: {
  label: string;
  value: ReactNode;
  delta?: number;
  spark?: number[];
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 bg-white/[0.015] p-5 backdrop-blur-xl">
      <span className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span
        className={`font-display text-3xl leading-none sm:text-[2.4rem] ${
          accent ? "text-signal" : "text-foreground"
        }`}
      >
        {value}
      </span>
      <div className="flex items-center justify-between gap-3">
        {delta !== undefined && (
          <span
            className={`font-mono text-[0.74rem] uppercase tracking-[0.1em] ${
              delta >= 0 ? "text-signal" : "text-muted-foreground"
            }`}
          >
            {delta >= 0 ? "▲" : "▼"} {pct(delta)}
          </span>
        )}
        {spark && (
          <div className="w-24">
            <Sparkline data={spark} up={(delta ?? 0) >= 0} />
          </div>
        )}
      </div>
    </div>
  );
}

// helper to expose a count-up number inside StatCard values
export function Count({
  value,
  prefix,
  suffix,
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  return (
    <span>
      {prefix}
      <NumberTicker value={value} decimalPlaces={decimals} className="text-inherit" />
      {suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AreaChart — reusable line+area with grid (intentui / 8bitcn chart)
// ---------------------------------------------------------------------------
export function AreaChart({
  data,
  height = "h-64 sm:h-80",
  format,
}: {
  data: Point[];
  height?: string;
  format?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { path, area, min, max, pts } = useMemo(() => {
    const W = 1000;
    const H = 300;
    const vs = data.map((d) => d.v);
    const mn = Math.min(...vs);
    const mx = Math.max(...vs);
    const pad = (mx - mn) * 0.12 || 0.01;
    const y = (v: number) => H - ((v - (mn - pad)) / (mx + pad - (mn - pad))) * H;
    const xs = data.map((_, i) => (i / (data.length - 1)) * W);
    const pstr = data.map((d, i) => `${xs[i].toFixed(1)},${y(d.v).toFixed(1)}`);
    const pts = data.map((d, i) => ({ xPct: (i / (data.length - 1)) * 100, yPct: (y(d.v) / H) * 100, v: d.v, t: d.t }));
    return {
      path: `M${pstr.join(" L")}`,
      area: `M${xs[0].toFixed(1)},${H} L${pstr.join(" L")} L${xs[xs.length - 1].toFixed(1)},${H} Z`,
      min: mn,
      max: mx,
      pts,
    };
  }, [data]);

  const onMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || data.length < 2) return;
    const idx = Math.round(((e.clientX - rect.left) / rect.width) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, idx)));
  };
  const hp = hover != null ? pts[hover] : null;

  return (
    <div className="relative">
      <div ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="relative cursor-crosshair">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-px w-full bg-border/50" />
          ))}
        </div>
        <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className={`relative w-full ${height}`}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34F003" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#34F003" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#areaFill)" />
          <path
            d={path}
            fill="none"
            stroke="#34F003"
            strokeWidth="2.5"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: "drop-shadow(0 0 8px rgba(52,240,3,0.45))" }}
          />
        </svg>
        {hp && (
          <>
            <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-white/20" style={{ left: `${hp.xPct}%` }} />
            <div className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(52,240,3,0.7)]" style={{ left: `${hp.xPct}%`, top: `${hp.yPct}%` }} />
            <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-md border border-border bg-[#0d0d0f] px-2 py-1 text-center" style={{ left: `clamp(44px, ${hp.xPct}%, calc(100% - 44px))`, top: `${hp.yPct}%` }}>
              <div className="font-mono text-[11px] tabular-nums text-signal">{format ? format(hp.v) : hp.v.toString()}</div>
              <div className="font-mono text-[9px] text-muted-foreground">{new Date(hp.t * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
            </div>
          </>
        )}
      </div>
      {format && (
        <div className="mt-3 flex justify-between font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground">
          <span>{format(min)}</span>
          <span>{format(max)}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SegmentMeter — stepped neon bar (8bitcn XP/health bar reinterpreted)
// ---------------------------------------------------------------------------
export function SegmentMeter({
  value,
  segments = 20,
  label,
  caption,
}: {
  value: number; // 0..100
  segments?: number;
  label?: string;
  caption?: string;
}) {
  const filled = Math.round((value / 100) * segments);
  return (
    <div>
      {label && (
        <div className="mb-2 flex items-baseline justify-between font-mono text-[0.74rem] uppercase tracking-[0.1em]">
          <span className="text-foreground">{label}</span>
          <span className="text-signal">{value.toFixed(1)}%</span>
        </div>
      )}
      <div className="flex gap-[3px]">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`h-4 flex-1 ${i < filled ? "bg-signal" : "bg-border/60"}`}
            style={i < filled ? { boxShadow: "0 0 8px rgba(52,240,3,0.4)" } : undefined}
          />
        ))}
      </div>
      {caption && (
        <p className="mt-2 font-mono text-[0.72rem] uppercase tracking-[0.1em] text-muted-foreground">
          {caption}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heatmap — daily volume density (kibo contribution graph)
// ---------------------------------------------------------------------------
export function Heatmap({ weeks }: { weeks: number[][] }) {
  return (
    <div className="flex gap-[3px] overflow-x-auto">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {week.map((v, di) => (
            <div
              key={di}
              className="size-3 shrink-0"
              style={{
                backgroundColor: `rgba(52,240,3,${(0.12 + v * 0.88).toFixed(2)})`,
              }}
              title={`${Math.round(v * 100)}%`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
