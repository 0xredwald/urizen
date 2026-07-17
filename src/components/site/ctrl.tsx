import { Reveal } from "@/components/fx/reveal";
import { Section } from "@/components/site/section";
import { CtrlOrbit } from "@/components/brand/marks";
import { BrutalLink, Eyebrow } from "@/components/site/primitives";

const PIPELINE = [
  "Deploy a fund",
  "Assign a strategy",
  "Tokenise it as a fund",
  "Capital allocates itself",
];

export function Ctrl() {
  return (
    <Section
      id="ctrl"
     
      className="border-t border-border bg-card/30"
    >
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <Reveal>
            <Eyebrow className="mb-7">The platform</Eyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mb-6 flex items-center gap-3">
              <CtrlOrbit className="size-9 text-[#a8a0eb]" />
              <span
                className="font-display text-4xl uppercase tracking-[0.04em] sm:text-5xl"
                style={{
                  background:
                    "linear-gradient(180deg, #ffffff 0%, #c9c6e6 45%, #8c86b8 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                CTRL
              </span>
            </div>
          </Reveal>
          <Reveal delay={0.16}>
            <h2 className="display-tight text-[clamp(2rem,5vw,3.6rem)]">
              Urizen is the
              <br />
              <span className="text-signal">first fund</span> on CTRL.
            </h2>
          </Reveal>
        </div>

        <div className="flex flex-col justify-center">
          <Reveal delay={0.18}>
            <p className="font-sans text-base leading-relaxed text-muted-foreground sm:text-lg">
              The automation layer on Robinhood Chain. It turns an autonomous fund into a public,
              tokenised fund — strategy, treasury and buyback in one pipeline. URIZEN is
              the flagship.
            </p>
          </Reveal>

          <Reveal delay={0.26} className="mt-9">
            <ol className="grid grid-cols-1 gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
              {PIPELINE.map((step, i) => (
                <li
                  key={step}
                  className="flex items-center gap-4 bg-card px-5 py-5"
                >
                  <span className="font-display text-xl text-[#a8a0eb]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-xs uppercase tracking-[0.1em] text-foreground">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={0.34} className="mt-9">
            <BrutalLink href="https://ctrl.fun" variant="ghost">
              Explore CTRL ↗
            </BrutalLink>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
