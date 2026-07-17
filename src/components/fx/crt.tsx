import { cn } from "@/lib/utils";

/** Lightweight CRT framing: static scanlines + tube vignette only.
 *  The moving "snow" lives in <TVSnow/>; everything here is GPU-cheap and still. */
export function CRTOverlay({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      <div className="crt-scanlines absolute inset-0" />
      <div className="crt-vignette absolute inset-0" />
    </div>
  );
}
