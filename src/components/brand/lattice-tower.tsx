import { cn } from "@/lib/utils";

/**
 * Procedural steel-lattice radio mast. Pure SVG so it scales crisply and
 * themes via currentColor. Blinking red aircraft beacon + signal pings at top.
 */
export function LatticeTower({
  className,
  segments = 11,
  beacon = true,
  signal = true,
  strokeWidth = 1.4,
}: {
  className?: string;
  segments?: number;
  beacon?: boolean;
  signal?: boolean;
  strokeWidth?: number;
}) {
  const H = 820;
  const baseHalf = 46;
  const topHalf = 7;
  const cx = 100;
  const topY = 70;
  const botY = H;

  // leg x at a given y (linear taper)
  const half = (y: number) => {
    const t = (y - topY) / (botY - topY);
    return topHalf + (baseHalf - topHalf) * t;
  };
  const segH = (botY - topY) / segments;

  const bars: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const yTop = topY + i * segH;
    const yBot = yTop + segH;
    const hTop = half(yTop);
    const hBot = half(yBot);
    // horizontal members
    bars.push({ x1: cx - hBot, y1: yBot, x2: cx + hBot, y2: yBot });
    // X bracing
    bars.push({ x1: cx - hTop, y1: yTop, x2: cx + hBot, y2: yBot });
    bars.push({ x1: cx + hTop, y1: yTop, x2: cx - hBot, y2: yBot });
  }

  return (
    <svg
      viewBox={`0 0 200 ${H}`}
      className={cn("block", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden
    >
      {/* legs */}
      <path
        d={`M ${cx - baseHalf} ${botY} L ${cx - topHalf} ${topY} M ${cx + baseHalf} ${botY} L ${cx + topHalf} ${topY}`}
        strokeWidth={strokeWidth * 1.4}
      />
      {bars.map((b, i) => (
        <line
          key={i}
          x1={b.x1}
          y1={b.y1}
          x2={b.x2}
          y2={b.y2}
          strokeOpacity={0.85}
        />
      ))}
      {/* mast + antennas */}
      <line x1={cx} y1={topY} x2={cx} y2={28} strokeWidth={strokeWidth * 1.6} />
      <line x1={cx - 16} y1={50} x2={cx + 16} y2={50} />
      <line x1={cx - 11} y1={40} x2={cx + 11} y2={40} />
      {/* side dish */}
      <circle cx={cx - 34} cy={half(topY + segH * 1.4) + topY + 60} r="9" strokeOpacity={0.7} />

      {beacon && (
        <>
          {signal && (
            <g style={{ transformOrigin: `${cx}px 28px` }}>
              <circle
                cx={cx}
                cy={28}
                r={10}
                stroke="var(--signal)"
                strokeWidth={1.2}
                style={{ transformOrigin: `${cx}px 28px`, animation: "ping-ring 3s ease-out infinite" }}
              />
              <circle
                cx={cx}
                cy={28}
                r={10}
                stroke="var(--signal)"
                strokeWidth={1}
                style={{ transformOrigin: `${cx}px 28px`, animation: "ping-ring 3s ease-out infinite 1.5s" }}
              />
            </g>
          )}
          <circle cx={cx} cy={28} r={4} fill="var(--signal)" stroke="none" className="anim-beacon" />
        </>
      )}
    </svg>
  );
}
