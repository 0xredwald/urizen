import Image from "next/image";
import { UrizenMark, BloombergMark } from "@/components/brand/marks";
import { Reveal } from "@/components/fx/reveal";
import { BrutalLink, Eyebrow } from "@/components/site/primitives";

export function Cta() {
  return (
    <section
      id="enter"
      className="scanlines relative overflow-hidden border-t border-border px-5 py-32 text-center sm:py-44"
    >
      {/* red dragon ghost */}
      <Image
        src="/img/blake-dragon.webp"
        alt=""
        fill
        sizes="100vw"
        className="pointer-events-none -z-20 object-cover opacity-[0.13] mix-blend-screen"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 50%, rgba(52, 240, 3,0.14), transparent 70%)",
        }}
      />
      <div
        className="halftone pointer-events-none absolute inset-0 -z-10 opacity-[0.12]"
        style={{
          maskImage: "radial-gradient(60% 50% at 50% 50%, #000, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(60% 50% at 50% 50%, #000, transparent 75%)",
        }}
      />

      <div className="mx-auto max-w-4xl">
        <Reveal>
          <UrizenMark className="anim-pulse-glow mx-auto mb-10 h-14 w-auto text-signal" />
        </Reveal>
        <Reveal delay={0.08}>
          <Eyebrow className="mb-8 justify-center">The onchain desk</Eyebrow>
        </Reveal>
        <Reveal delay={0.14}>
          <h2 className="display-tight text-[clamp(2rem,6.4vw,5rem)] leading-[1.06] glow-red">
            <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <span>TradFi has</span>
              <BloombergMark className="text-[0.82em]" />
              <span>.</span>
            </span>
            <span className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <span>Now crypto has</span>
              <span className="inline-flex items-center gap-2.5 normal-case">
                <UrizenMark className="h-[0.82em] w-auto text-signal" />
                <span className="font-display font-black tracking-tight text-signal">Urizen.</span>
              </span>
            </span>
          </h2>
        </Reveal>
        <Reveal delay={0.26} className="mt-12">
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <BrutalLink href="/terminal" variant="signal">
              Open the terminal ↗
            </BrutalLink>
            <BrutalLink href="/token" variant="ghost">
              Get $URI
            </BrutalLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
