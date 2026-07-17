import { Reveal } from "@/components/fx/reveal";
import { InViewGroup } from "@/components/fx/in-view-group";
import { Section } from "@/components/site/section";
import { Eyebrow } from "@/components/site/primitives";

/* distinct glyph per node — paused until the loop scrolls into view */
function Glyph({ i, className = "h-6 w-6" }: { i: number; className?: string }) {
  const cls = `${className} text-signal`;
  switch (i) {
    case 0: // Agent — a watching core
      return (
        <svg viewBox="0 0 28 28" className={cls} fill="none" aria-hidden>
          <circle cx="14" cy="14" r="11" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
          <circle cx="14" cy="14" r="6" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="14" cy="14" r="2.4" fill="currentColor" className="anim-pulse-glow" />
        </svg>
      );
    case 1: // Strategy — branching paths
      return (
        <svg viewBox="0 0 28 28" className={cls} fill="none" aria-hidden>
          <path d="M4 14 H12" stroke="currentColor" strokeWidth="1.4" />
          <path d="M12 14 L22 6 M12 14 L22 14 M12 14 L22 22" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
          <circle cx="12" cy="14" r="2" fill="currentColor" />
          <circle cx="22" cy="6" r="1.6" fill="currentColor" />
          <circle cx="22" cy="14" r="1.6" fill="currentColor" style={{ animationDelay: "0.6s" }} />
          <circle cx="22" cy="22" r="1.6" fill="currentColor" style={{ animationDelay: "1.2s" }} />
        </svg>
      );
    case 2: // Vault — sealed
      return (
        <svg viewBox="0 0 28 28" className={cls} fill="none" aria-hidden>
          <rect x="5" y="8" width="18" height="15" stroke="currentColor" strokeWidth="1.4" />
          <path d="M9 8 V6 a5 5 0 0 1 10 0 V8" stroke="currentColor" strokeWidth="1.4" opacity="0.6" />
          <circle cx="14" cy="15" r="2.2" fill="currentColor" className="anim-pulse-glow" />
          <path d="M14 17 V20" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case 3: // Execution — onchain blocks
      return (
        <svg viewBox="0 0 28 28" className={cls} fill="none" aria-hidden>
          <rect x="4" y="11" width="6" height="6" stroke="currentColor" strokeWidth="1.4" />
          <rect x="11" y="11" width="6" height="6" stroke="currentColor" strokeWidth="1.4" style={{ animationDelay: "0.5s" }} />
          <rect x="18" y="11" width="6" height="6" stroke="currentColor" strokeWidth="1.4" style={{ animationDelay: "1s" }} />
          <path d="M10 14 H11 M17 14 H18" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    default: // Buyback — closed loop
      return (
        <svg viewBox="0 0 28 28" className={cls} fill="none" aria-hidden>
          <g className="anim-spin-slow" style={{ transformOrigin: "14px 14px" }}>
            <path d="M22 14 a8 8 0 1 1 -2.4 -5.7" stroke="currentColor" strokeWidth="1.4" />
            <path d="M19.6 3.4 L19.6 8.3 L14.8 8.3" stroke="currentColor" strokeWidth="1.4" />
          </g>
          <circle cx="14" cy="14" r="2.2" fill="currentColor" className="anim-pulse-glow" />
        </svg>
      );
  }
}

const NODES = [
  { gi: 0, label: "Signals", pos: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" },
  { gi: 1, label: "Strategy", pos: "right-0 top-1/2 -translate-y-1/2 translate-x-1/2" },
  { gi: 3, label: "Execution", pos: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2" },
  { gi: 4, label: "Buyback", pos: "left-0 top-1/2 -translate-y-1/2 -translate-x-1/2" },
];

function OrbitNode({ gi, label, pos }: { gi: number; label: string; pos: string }) {
  return (
    <div className={`absolute flex w-24 flex-col items-center gap-1.5 ${pos}`}>
      <span className="grid size-10 place-items-center rounded-full border border-border bg-background">
        <Glyph i={gi} className="h-5 w-5" />
      </span>
      <span className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function Mechanism() {
  return (
    <Section id="mechanism" className="border-t border-border">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-16">
        <div className="max-w-md">
          <Reveal>
            <Eyebrow className="mb-7">How it runs</Eyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="display-tight display-black text-[clamp(2.6rem,7vw,5.5rem)]">
              One loop.
              <br />
              <span className="text-signal">No hands.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-7 font-sans text-lg leading-relaxed text-muted-foreground">
              Everything orbits one onchain account. The fund invests, settles
              onchain, and routes profit back into the token. All of it public.
            </p>
          </Reveal>
        </div>

        {/* the loop */}
        <Reveal delay={0.2} blur>
          <InViewGroup className="relative mx-auto aspect-square w-full max-w-[400px]">
            <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
              {/* spokes */}
              {["M100 100 V22", "M100 100 H178", "M100 100 V178", "M100 100 H22"].map((d, i) => (
                <path key={i} d={d} stroke="var(--border)" strokeWidth="1" strokeDasharray="1.5 4" />
              ))}
              {/* orbit ring */}
              <circle cx="100" cy="100" r="78" fill="none" stroke="var(--border)" strokeWidth="1" />
              {/* a single dot that steps around the ring, stopping + glitching at each node */}
              <g className="orbit-step">
                <circle
                  className="orbit-glitch"
                  cx="100"
                  cy="22"
                  r="4.5"
                  fill="var(--signal)"
                  style={{ filter: "drop-shadow(0 0 7px rgba(52, 240, 3,0.9))" }}
                />
              </g>
            </svg>

            {/* center: the vault */}
            <div className="absolute left-1/2 top-1/2 flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center">
              <span className="grid size-14 place-items-center rounded-full border border-signal/45 bg-background shadow-[0_0_28px_rgba(52, 240, 3,0.18)]">
                <Glyph i={2} className="h-7 w-7" />
              </span>
              <span className="font-display text-sm font-bold uppercase tracking-tight">Book</span>
              <span className="-mt-1.5 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
                Onchain
              </span>
            </div>

            {NODES.map((n) => (
              <OrbitNode key={n.label} {...n} />
            ))}
          </InViewGroup>
        </Reveal>
      </div>
    </Section>
  );
}
