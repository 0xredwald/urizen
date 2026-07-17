import { cn } from "@/lib/utils";

/** CRT power-on title: collapses in like a tube switching on, with RGB ghosts
 *  that glitch and converge, then settle to a dead-clean black wordmark. */
export function TVTitle({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("tv-title relative", className)} aria-label={text}>
      <span className="tv-title-base">{text}</span>
      <span className="tv-title-ghost tv-ghost-r" aria-hidden>
        {text}
      </span>
      <span className="tv-title-ghost tv-ghost-c" aria-hidden>
        {text}
      </span>
    </span>
  );
}
