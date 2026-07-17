import { cn } from "@/lib/utils";

/** Dark neon shimmer skeleton. Match final content dimensions to avoid CLS. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

/** Chart-shaped skeleton: gridlines + faux bars so the eye expects a chart. */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0 flex flex-col justify-between py-1 opacity-40">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border-t border-white/[0.06]" />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-full items-end gap-2 p-1">
        {[38, 52, 44, 61, 49, 70, 58, 78, 66, 84].map((hgt, i) => (
          <div
            key={i}
            className="skeleton flex-1"
            style={{ height: `${hgt}%`, animationDelay: `${i * 0.05}s` }}
          />
        ))}
      </div>
    </div>
  );
}
