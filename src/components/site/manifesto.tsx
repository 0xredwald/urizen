import { UrizenMark } from "@/components/brand/marks";
import { Reveal } from "@/components/fx/reveal";
import { Pop } from "@/components/fx/pop";
import { Section } from "@/components/site/section";
import { Eyebrow } from "@/components/site/primitives";

type EraKey = "institutions" | "individuals" | "software" | "agents";

const ERAS: { n: string; label: string; key: EraKey; text: React.ReactNode }[] = [
  {
    n: "01",
    label: "Institutions",
    key: "institutions",
    text: <>For centuries, capital allocation was controlled by institutions.</>,
  },
  {
    n: "02",
    label: "Individuals",
    key: "individuals",
    text: <>Then individuals got access.</>,
  },
  {
    n: "03",
    label: "Software",
    key: "software",
    text: (
      <>
        Now <span className="text-signal">software</span> does.
      </>
    ),
  },
  {
    n: "04",
    label: "Agents",
    key: "agents",
    text: (
      <>
        AI agents compete to generate returns, deploy capital, and accelerate the
        autonomous economy.
      </>
    ),
  },
];

/* ---- per-era animated diagrams (120×120 viewbox) ---- */
function EraVisual({ kind }: { kind: EraKey }) {
  const base = "h-28 w-28 sm:h-32 sm:w-32";

  if (kind === "institutions") {
    // a few tall gated monoliths; outside flows funnel into the center one
    const bars = [
      { x: 16, h: 44, on: false },
      { x: 38, h: 64, on: false },
      { x: 60, h: 80, on: true },
      { x: 82, h: 56, on: false },
      { x: 104, h: 40, on: false },
    ];
    return (
      <svg viewBox="0 0 120 120" className={base} aria-hidden>
        {/* gate line */}
        <line x1="6" y1="30" x2="114" y2="30" stroke="var(--border)" strokeWidth="1" strokeDasharray="2 4" />
        {bars.map((b, i) => (
          <g key={i}>
            <rect
              x={b.x - 6}
              y={104 - b.h}
              width="12"
              height={b.h}
              fill={b.on ? "var(--signal)" : "transparent"}
              stroke={b.on ? "var(--signal)" : "rgba(242,241,236,0.28)"}
              strokeWidth="1"
            />
            {b.on && (
              <rect
                x={b.x - 6}
                y={104 - b.h}
                width="12"
                height={b.h}
                fill="var(--signal)"
                className="era-twinkle"
                opacity="0.5"
              />
            )}
          </g>
        ))}
        <line x1="6" y1="104" x2="114" y2="104" stroke="rgba(242,241,236,0.4)" strokeWidth="1" />
      </svg>
    );
  }

  if (kind === "individuals") {
    // a crowd of nodes, each wired to a shared center — access opens up
    const ring = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return { x: 60 + Math.cos(a) * 44, y: 60 + Math.sin(a) * 44, d: i * 0.18 };
    });
    return (
      <svg viewBox="0 0 120 120" className={base} aria-hidden>
        {ring.map((p, i) => (
          <line key={`l${i}`} x1="60" y1="60" x2={p.x} y2={p.y} stroke="rgba(242,241,236,0.16)" strokeWidth="0.75" />
        ))}
        {ring.map((p, i) => (
          <circle
            key={`c${i}`}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="rgba(242,241,236,0.85)"
            className="era-twinkle"
            style={{ animationDelay: `${p.d}s` }}
          />
        ))}
        <circle cx="60" cy="60" r="5" fill="var(--signal)" />
      </svg>
    );
  }

  if (kind === "software") {
    // an algorithmic grid that lights cell-by-cell in a flowing diagonal wave
    const cells = [];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++) cells.push({ x: 14 + c * 23, y: 14 + r * 23, wave: r + c });
    return (
      <svg viewBox="0 0 120 120" className={base} aria-hidden>
        {cells.map((p, i) => (
          <g key={i}>
            <rect x={p.x} y={p.y} width="14" height="14" fill="none" stroke="rgba(242,241,236,0.18)" strokeWidth="1" />
            <rect
              x={p.x}
              y={p.y}
              width="14"
              height="14"
              fill="var(--signal)"
              className="era-twinkle"
              style={{ animationDelay: `${p.wave * 0.22}s`, animationDuration: "2.2s" }}
            />
          </g>
        ))}
      </svg>
    );
  }

  // agents — a single autonomous red core with orbiting satellites + the mark
  return (
    <svg viewBox="0 0 120 120" className={base} aria-hidden>
      <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(52, 240, 3,0.18)" strokeWidth="1" />
      <circle cx="60" cy="60" r="30" fill="none" stroke="rgba(52, 240, 3,0.28)" strokeWidth="1" strokeDasharray="3 4" />
      <g className="era-orbit">
        <circle cx="106" cy="60" r="3.5" fill="var(--signal)" />
      </g>
      <g className="era-orbit-rev">
        <circle cx="60" cy="14" r="2.5" fill="rgba(242,241,236,0.8)" />
      </g>
      <circle cx="60" cy="60" r="14" fill="var(--signal)" className="anim-pulse-glow" />
      <circle cx="60" cy="60" r="14" fill="none" stroke="var(--signal)" strokeWidth="1.5" />
    </svg>
  );
}

export function Manifesto() {
  return (
    <Section className="border-t border-border">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <Eyebrow className="mb-12">The shift in who allocates</Eyebrow>
        </Reveal>

        {/* ledger of eras, each with a animated diagram */}
        <ol className="border-t border-border">
          {ERAS.map((e, i) => (
            <Reveal key={e.n} delay={i * 0.06}>
              <li className="group grid grid-cols-1 items-center gap-x-10 gap-y-6 border-b border-border py-10 transition-colors hover:bg-card/40 sm:grid-cols-[140px_1fr] sm:gap-x-12 lg:grid-cols-[140px_180px_1fr]">
                {/* number + label */}
                <div className="flex items-start gap-4 lg:flex-col lg:gap-3">
                  <span className="font-display text-3xl font-bold leading-none text-signal">
                    {e.n}
                  </span>
                  <span className="mt-1.5 font-mono text-[0.78rem] uppercase tracking-[0.2em] text-muted-foreground lg:mt-0">
                    {e.label}
                  </span>
                </div>

                {/* diagram */}
                <div className="flex justify-start sm:justify-center lg:justify-start">
                  <EraVisual kind={e.key} />
                </div>

                {/* statement */}
                <p className="font-display text-[clamp(1.5rem,3.4vw,2.6rem)] font-semibold leading-[1.08] tracking-tight text-foreground">
                  {e.text}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>

        {/* closer */}
        <Pop delay={0.05}>
          <div className="mt-16 flex flex-col items-center text-center">
            <UrizenMark className="anim-float mb-8 h-12 w-auto text-signal" />
            <p className="display-tight display-black text-[clamp(2.4rem,8vw,6rem)] text-signal [text-shadow:0_0_14px_rgba(52, 240, 3,0.25)]">
              Capital has become
              <br />
              autonomous.
            </p>
          </div>
        </Pop>
      </div>
    </Section>
  );
}
