import type { ReactNode } from "react";

export type Slice = { label: string; pct: number; color: string };

/**
 * SVG allocation ring. `stroke-dasharray` on stacked circles, small gaps
 * between slices. Center hole shows one hero number.
 */
export function Donut({
  slices,
  size = 190,
  stroke = 18,
  center,
  gap = 1.5,
}: {
  slices: Slice[];
  size?: number;
  stroke?: number;
  center?: ReactNode;
  gap?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative inline-grid place-items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        {slices.map((s, i) => {
          const len = (s.pct / 100) * c;
          const dash = Math.max(len - gap, 0);
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              style={s.color === "var(--signal)" || s.color.includes("52,240,3") ? { filter: "drop-shadow(0 0 6px rgba(52,240,3,0.45))" } : undefined}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      {center && (
        <div className="absolute inset-0 grid place-items-center text-center">{center}</div>
      )}
    </div>
  );
}
