import Image from "next/image";
import { Reveal } from "@/components/fx/reveal";
import { Section } from "@/components/site/section";
import { Eyebrow } from "@/components/site/primitives";

export function Reason() {
  return (
    <Section
      id="reason"
     
      className="overflow-hidden border-t border-border"
    >
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        {/* image */}
        <Reveal blur className="order-2 lg:order-1">
          <figure
            className="scanlines relative mx-auto aspect-[1300/1795] w-full max-w-md overflow-hidden border border-border"
            style={{ isolation: "isolate" }}
          >
            <Image
              src="/img/blake-ancient.webp"
              alt="William Blake — The Ancient of Days. Urizen leans from the sun and measures the void with a compass."
              fill
              sizes="(max-width: 1024px) 90vw, 40vw"
              className="object-cover grayscale contrast-[1.15] brightness-110"
            />
            {/* neon-green duotone: grayscale image × signal green (multiply) */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "var(--signal)", mixBlendMode: "multiply" }}
            />
            {/* lift highlights back toward neon green */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "rgba(52,240,3,0.14)", mixBlendMode: "screen" }}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 100% at 50% 30%, transparent 40%, rgba(10,10,11,0.55) 100%)",
              }}
            />
            <figcaption className="absolute bottom-3 left-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-foreground/70">
              W. Blake · The Ancient of Days · 1794
            </figcaption>
          </figure>
        </Reveal>

        {/* copy */}
        <div className="order-1 lg:order-2">
          <Reveal>
            <Eyebrow className="mb-7">Why “Urizen”</Eyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="display-tight text-[clamp(2.4rem,6.5vw,5rem)]">
              Reason,
              <br />
              <span className="text-signal">measured.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="mt-7 space-y-5 font-sans text-base leading-relaxed text-muted-foreground sm:text-lg">
              <p>
                In William Blake’s mythology, Urizen is the embodiment of reason,
                law and measurement — the architect who leans from the sun and sets
                a compass to the void.
              </p>
              <p>
                It is the oldest image of capital allocation: bounding the
                unbounded, imposing order on chaos with an instrument. We took the
                name because that is exactly what the fund does — only now the hand
                on the compass is software.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.24}>
            <p className="mt-9 font-display text-lg uppercase tracking-[0.02em] text-foreground">
              The measure is automated.
            </p>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
