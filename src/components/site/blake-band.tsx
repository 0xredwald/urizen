import { Section } from "@/components/site/section";
import { BlakePlate } from "@/components/site/blake-plate";

export function BlakeBand() {
  return (
    <Section id="lineage" className="border-t border-border">
      <div className="relative overflow-hidden rounded-[3px]">
        <BlakePlate
          src="/img/blake-ancient.webp"
          alt="William Blake, The Ancient of Days, Urizen measuring the void with a compass"
          className="aspect-[16/9] sm:aspect-[16/7]"
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">
            Named for Blake&apos;s Urizen
          </span>
          <p className="mt-2 display-tight text-[clamp(1.8rem,5vw,3.6rem)] text-foreground">
            Reason, <span className="text-signal">measured.</span>
          </p>
        </div>
      </div>
    </Section>
  );
}
