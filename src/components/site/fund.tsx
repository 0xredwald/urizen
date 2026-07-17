import { Reveal } from "@/components/fx/reveal";
import { Section } from "@/components/site/section";
import { Eyebrow } from "@/components/site/primitives";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

function Cell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("group relative bg-card p-7 transition-colors hover:bg-concrete sm:p-9", className)}>
      {children}
    </div>
  );
}

export function Fund() {
  return (
    <Section id="fund" className="border-t border-border">
      <div className="max-w-2xl">
        <Reveal>
          <Eyebrow className="mb-7">The fund</Eyebrow>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="display-tight text-[clamp(2.4rem,6.5vw,5rem)]">
            One rule the
            <br />
            <span className="text-signal">code enforces.</span>
          </h2>
        </Reveal>
      </div>

      <Reveal delay={0.16} className="mt-14">
        <div className="grid grid-cols-1 gap-px overflow-hidden border border-border bg-border md:grid-cols-3">
          {/* big onchain rule */}
          <Cell className="md:col-span-2 md:row-span-2">
            <Eyebrow marker={false} className="text-signal">
              Onchain by default
            </Eyebrow>
            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-12">
              <div>
                <p className="font-display text-4xl uppercase leading-none sm:text-5xl">
                  <span className="text-signal">Verify</span> it
                </p>
                <p className="mt-3 font-display text-4xl uppercase leading-none text-muted-foreground line-through decoration-signal/70 sm:text-5xl">
                  Trust us
                </p>
              </div>
            </div>
            <p className="mt-8 max-w-md font-sans text-sm leading-relaxed text-muted-foreground">
              The fund&apos;s book and every trade live onchain on Robinhood Chain —
              public and auditable. Read the performance from the wallet; don&apos;t take our word.
            </p>
          </Cell>

          <Cell>
            <p className="font-display text-5xl leading-none text-signal sm:text-6xl">
              <NumberTicker value={100} className="text-signal" />%
            </p>
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em]">
              Non-custodial
            </p>
            <p className="mt-1 font-mono text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">
              You hold the keys
            </p>
          </Cell>

          <Cell>
            <p className="font-display text-5xl uppercase leading-none text-signal sm:text-6xl">
              24/7
            </p>
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em]">
              Execution
            </p>
            <p className="mt-1 font-mono text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">
              No market hours
            </p>
          </Cell>

          {/* buyback */}
          <Cell className="md:col-span-2">
            <Eyebrow marker={false} className="text-signal">
              Buyback
            </Eyebrow>
            <p className="mt-4 font-display text-2xl uppercase leading-tight sm:text-3xl">
              The token buys itself back from real profit and fees.
            </p>
            <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">
              Performance accrues to $URI holders directly. No management
              layer skimming the difference.
            </p>
          </Cell>

          {/* metrics TBD — honest */}
          <Cell>
            <Eyebrow marker={false} className="text-muted-foreground">Metrics</Eyebrow>
            <div className="mt-5 space-y-4">
              {["TVL", "Buyback volume", "Realised P&L"].map((m) => (
                <div key={m} className="flex items-baseline justify-between border-b border-border/60 pb-2">
                  <span className="font-mono text-[0.78rem] uppercase tracking-[0.1em] text-muted-foreground">
                    {m}
                  </span>
                  <span className="font-mono text-[0.78rem] uppercase tracking-[0.14em] text-signal">
                    TBD
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-5 flex items-center gap-2 font-mono text-[0.74rem] uppercase tracking-[0.1em] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-signal" />
              Indexing onchain
            </p>
          </Cell>
        </div>
      </Reveal>
    </Section>
  );
}
