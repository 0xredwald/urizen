"use client";

import {
  ScrollVelocityContainer,
  ScrollVelocityRow,
} from "@/components/ui/scroll-based-velocity";

export function VelocityBand() {
  return (
    <div className="relative overflow-hidden border-y border-border py-10 sm:py-14">
      <ScrollVelocityContainer className="font-display uppercase">
        <ScrollVelocityRow baseVelocity={6} direction={1} className="py-1">
          <span className="text-[clamp(2.5rem,9vw,7rem)] leading-none tracking-[-0.02em] text-foreground/[0.08]">
            Autonomous capital&nbsp;·&nbsp;
          </span>
          <span className="text-[clamp(2.5rem,9vw,7rem)] leading-none tracking-[-0.02em] text-signal/80">
            The first autonomous fund on Robinhood Chain&nbsp;·&nbsp;
          </span>
        </ScrollVelocityRow>
        <ScrollVelocityRow baseVelocity={6} direction={-1} className="py-1">
          <span className="text-[clamp(2.5rem,9vw,7rem)] leading-none tracking-[-0.02em] text-foreground/[0.08]">
            Urizen&nbsp;·&nbsp;The measure is automated&nbsp;·&nbsp;
          </span>
        </ScrollVelocityRow>
      </ScrollVelocityContainer>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
