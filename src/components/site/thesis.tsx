import { Reveal } from "@/components/fx/reveal";
import { Section } from "@/components/site/section";
import { Eyebrow } from "@/components/site/primitives";

const TENETS = [
  {
    n: "01",
    title: "The fund allocates itself",
    body: "Agent-powered strategies allocate across tokenized stocks, RWAs and crypto — sizing, hedging and rebalancing continuously. No committee, no discretion, no approval loops.",
  },
  {
    n: "02",
    title: "Onchain, or it didn't happen",
    body: "The fund's book and every trade live onchain on Robinhood Chain — public and auditable. You don't trust the performance, you read it from the wallet.",
  },
  {
    n: "03",
    title: "The token buys itself back",
    body: "$URI buys itself back from the fund's real profits and fees. Performance flows to the token, not to a manager.",
  },
];

export function Thesis() {
  return (
    <Section id="thesis">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
        <div>
          <Reveal>
            <Eyebrow className="mb-7">The shift</Eyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="display-tight text-[clamp(2.4rem,6.5vw,5rem)]">
              Funds you pick.
              <br />
              <span className="text-signal">Urizen runs itself.</span>
            </h2>
          </Reveal>
        </div>
        <Reveal delay={0.16} className="flex items-end">
          <p className="font-sans text-base leading-relaxed text-muted-foreground sm:text-lg">
            Every other fund still puts a human in the seat — picking, timing,
            second-guessing. Urizen removes the seat. Software holds the mandate,
            allocates across tokenized stocks, RWAs and crypto, and compounds the
            result onchain — continuously, without asking permission.
          </p>
        </Reveal>
      </div>

      <div className="mt-20 grid grid-cols-1 gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
        {TENETS.map((t, i) => (
          <Reveal key={t.n} delay={0.1 + i * 0.1} className="bg-card">
            <div className="group h-full p-8 transition-colors hover:bg-concrete">
              <div className="flex items-center justify-between">
                <span className="font-display text-3xl text-signal">{t.n}</span>
                <span className="h-px w-10 bg-border transition-all group-hover:w-16 group-hover:bg-signal" />
              </div>
              <h3 className="mt-7 font-display text-lg uppercase tracking-[0.02em]">
                {t.title}
              </h3>
              <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">
                {t.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
