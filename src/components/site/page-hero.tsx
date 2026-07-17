import type { ReactNode } from "react";
import { Reveal } from "@/components/fx/reveal";
import { Eyebrow } from "@/components/site/primitives";

export function PageHero({
  eyebrow,
  title,
  accent,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  accent?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="scanlines relative overflow-hidden px-5 pt-36 pb-16 sm:px-8 sm:pt-44 sm:pb-20">
      {/* halftone + glow */}
      <div
        className="halftone pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          maskImage: "radial-gradient(70% 60% at 30% 0%, #000, transparent 75%)",
          WebkitMaskImage: "radial-gradient(70% 60% at 30% 0%, #000, transparent 75%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(to right, transparent, var(--signal), transparent)" }}
      />
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <Eyebrow className="mb-7">{eyebrow}</Eyebrow>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="display-tight display-black text-[clamp(2.1rem,8vw,7rem)]">
            {title} {accent && <span className="text-signal">{accent}</span>}
          </h1>
        </Reveal>
        {children && (
          <Reveal delay={0.16} className="mt-8 max-w-2xl">
            <div className="font-sans text-lg leading-relaxed text-muted-foreground">
              {children}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
