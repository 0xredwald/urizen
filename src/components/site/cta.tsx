import Image from "next/image";
import { UrizenMark } from "@/components/brand/marks";
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
          <Eyebrow className="mb-8 justify-center">Now on Robinhood Chain</Eyebrow>
        </Reveal>
        <Reveal delay={0.14}>
          <h2 className="display-tight text-[clamp(2.8rem,9vw,7rem)] glow-red">
            Back the first
            <br />
            <span className="text-signal">autonomous fund.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.26} className="mt-12">
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <BrutalLink href="/token" variant="signal">
              Get $URI ↗
            </BrutalLink>
            <BrutalLink href="/fund" variant="ghost">
              View the fund
            </BrutalLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
