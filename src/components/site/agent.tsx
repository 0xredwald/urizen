import { Reveal } from "@/components/fx/reveal";
import { Section } from "@/components/site/section";
import { AgentCore } from "@/components/site/agent-core";
import { BrutalLink, Eyebrow } from "@/components/site/primitives";

const VITALS = [
  { k: "Objective", v: "Maximize long-term returns" },
  { k: "Assets", v: "Stocks · RWAs · crypto" },
  { k: "Chain", v: "Robinhood Chain" },
  { k: "Custody", v: "Onchain wallet" },
  { k: "Execution", v: "24/7 · continuous" },
  { k: "Reporting", v: "Public · fully onchain" },
];

export function Agent() {
  return (
    <Section id="agent" className="border-t border-border">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
        <Reveal blur className="order-2 lg:order-1">
          <AgentCore />
        </Reveal>

        <div className="order-1 lg:order-2">
          <Reveal>
            <Eyebrow className="mb-7">Autonomous fund · Robinhood Chain</Eyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="display-tight text-[clamp(2.4rem,6.5vw,5rem)]">
              A fund that
              <br />
              <span className="text-signal">allocates itself.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-7 max-w-md font-sans text-base leading-relaxed text-muted-foreground sm:text-lg">
              A tokenized fund with no manager. Agent-powered strategies allocate
              across stocks, RWAs and crypto, 24/7, to maximize long-term returns.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <dl className="mt-10 grid grid-cols-1 gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
              {VITALS.map((row) => (
                <div key={row.k} className="bg-card px-5 py-4">
                  <dt className="font-mono text-[0.74rem] uppercase tracking-[0.16em] text-muted-foreground">
                    {row.k}
                  </dt>
                  <dd className="mt-1 font-mono text-[0.8rem] uppercase tracking-[0.04em] text-foreground">
                    {row.v}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={0.32} className="mt-9">
            <div className="flex flex-col gap-3 sm:flex-row">
              <BrutalLink href="/fund" variant="signal">
                View the dashboard
              </BrutalLink>
              <BrutalLink href="/token" variant="ghost">
                $URI token ↗
              </BrutalLink>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
