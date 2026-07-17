import { Section } from "@/components/site/section";
import { STRATEGIES } from "@/lib/strategies";

export function Strategies() {
  const live = STRATEGIES.filter((s) => s.status === "live").length;

  return (
    <Section id="strategies" index="04 / STRATEGIES" className="border-t border-border">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-signal">The engine</span>
          <h2 className="display-tight mt-3 text-[clamp(2rem,5.5vw,4rem)]">
            Mandates, <span className="text-signal">running.</span>
          </h2>
          <p className="mt-4 font-mono text-[0.85rem] leading-relaxed text-muted-foreground">
            Bounded, rules-based strategies executed onchain — accumulation, momentum, rotation,
            yield and reflexive buyback. Each one a mandate the fund runs, not a promise it makes.
          </p>
        </div>
        <div className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="text-signal">{live}</span> live · {STRATEGIES.length - live} arming
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[3px] border border-white/[0.08] bg-white/[0.08] md:grid-cols-2">
        {STRATEGIES.map((s) => (
          <div key={s.id} className="flex flex-col bg-background/70 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <span className="border border-white/15 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
                {s.kind}
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[0.64rem] uppercase tracking-[0.12em]">
                <span className={`h-1.5 w-1.5 rounded-full ${s.status === "live" ? "bg-signal" : "bg-white/30"}`} />
                <span className={s.status === "live" ? "text-signal" : "text-muted-foreground"}>{s.status}</span>
              </span>
            </div>

            <h3 className="mt-4 font-display text-xl leading-tight text-foreground">{s.name}</h3>
            <p className="mt-3 flex-1 font-mono text-[0.8rem] leading-relaxed text-muted-foreground">{s.summary}</p>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {s.targets.map((t) => (
                <span key={t} className="border border-signal/25 bg-signal/[0.05] px-1.5 py-0.5 font-mono text-[0.66rem] tracking-[0.04em] text-signal/90">
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground">
              <span>{s.cadence}</span>
              <span className="tabular-nums text-foreground">{s.allocationPct}% sleeve</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
