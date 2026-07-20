import { cn } from "@/lib/utils";

const URIZEN_PATH =
  "M 456 696 L 318 558 L 178 696 L 0 517 L 2 166 L 180 0 L 182 453 L 276 546 L 278 166 L 458 1 L 458 453 L 580 574 Z";

/** The URIZEN blade mark. Defaults to the signal-red colorway. */
export function UrizenMark({
  className,
  title = "URIZEN",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 580 696"
      role="img"
      aria-label={title}
      className={cn("block", className)}
      fill="currentColor"
    >
      <path d={URIZEN_PATH} />
    </svg>
  );
}

/** The Bloomberg brand name, set as a wordmark — used ONLY comparatively ("TradFi has Bloomberg,
 *  now crypto has Urizen"). Mixed-case bold sans so it reads as the wordmark next to our display type. */
export function BloombergMark({ className }: { className?: string }) {
  return (
    <span
      aria-label="Bloomberg"
      className={cn("inline-block whitespace-nowrap font-extrabold normal-case leading-none tracking-[-0.025em] text-white", className)}
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      Bloomberg
    </span>
  );
}

/** The actual CTRL mark — eye/orbit with the inner four-point star. Monochrome
 *  (currentColor), so it takes whatever color you give it. */
export function CtrlOrbit({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 361.88 361.89"
      className={cn("block", className)}
      fill="currentColor"
      role="img"
      aria-label="CTRL"
    >
      <path d="M180.94,0C81.01,0,0,81.01,0,180.94s81.01,180.95,180.94,180.95,180.94-81.01,180.94-180.95S280.87,0,180.94,0ZM99.04,288.54L23.68,213.18c-17.77-17.78-17.77-46.7,0-64.47l75.36-75.36c-12.54,30.88-19.34,68.32-19.34,107.6s6.8,76.71,19.34,107.59ZM235,296.35c-15.07,28.45-34.31,44.12-54.19,44.12s-39.13-15.67-54.19-44.12c-16.22-30.65-25.16-71.63-25.16-115.4s8.94-84.76,25.16-115.41c15.06-28.45,34.31-44.12,54.19-44.12s39.12,15.67,54.19,44.12c16.22,30.65,25.16,71.63,25.16,115.41s-8.94,84.75-25.16,115.4ZM262.58,288.53c12.55-30.88,19.34-68.31,19.34-107.58s-6.79-76.71-19.34-107.59l75.36,75.35c8.61,8.61,13.35,20.06,13.35,32.23s-4.74,23.62-13.35,32.24l-75.36,75.35Z" />
      <path d="M256.32,180.95l-2.85.61c-37.88,8.11-65.99,40.07-69.17,78.69l-3.49,42.33-3.49-42.33c-3.19-38.61-31.29-70.58-69.17-78.69l-2.85-.61,2.85-.61c37.89-8.11,65.99-40.07,69.17-78.69l3.49-42.33,3.49,42.33c3.18,38.61,31.28,70.58,69.17,78.69l2.85.61Z" />
    </svg>
  );
}

export function CtrlLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <CtrlOrbit className="size-4 text-signal" />
      <span className="font-display text-[0.95em] tracking-[0.05em]">CTRL</span>
    </span>
  );
}
