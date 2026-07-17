import { Marquee } from "@/components/ui/marquee";
import { UrizenMark } from "@/components/brand/marks";

const ITEMS = [
  "The first autonomous fund on Robinhood Chain",
  "Tokenized stocks · RWAs · crypto",
  "Agent-powered capital allocation",
  "24 / 7 execution",
  "Onchain · every trade verifiable",
  "Profits buy back $URI",
  "Transparent · fully onchain",
];

export function Ticker() {
  return (
    <div className="relative border-y border-border bg-card/40 py-4">
      <Marquee className="[--duration:34s] [--gap:3rem]">
        {ITEMS.map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-12 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
          >
            <span>{t}</span>
            <UrizenMark className="h-3.5 w-auto text-signal" />
          </span>
        ))}
      </Marquee>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
