import Link from "next/link";
import { Section } from "@/components/site/section";
import { BlakePlate } from "@/components/site/blake-plate";

const CAPS = ["Research companies", "Analyse charts", "Compare businesses", "Explain earnings", "Build strategies"];

export function AlphaBand() {
  return (
    <Section id="alpha" index="01 / intelligence" className="border-t border-border">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <div className="order-2 lg:order-1">
          <BlakePlate
            src="/img/blake-newton.webp"
            alt="William Blake, Newton — reason measuring the deep with a compass"
            className="aspect-[4/3]"
          />
        </div>
        <div className="order-1 grid gap-6 lg:order-2">
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-signal">Meet Urizen Alpha</span>
          <h2 className="display-tight text-[clamp(2.2rem,5.5vw,4.4rem)] leading-[0.92] text-foreground">
            The AI equity<br />research agent.
          </h2>
          <p className="max-w-md text-pretty text-[1.05rem] leading-relaxed text-muted-foreground">
            Institutional-grade stock research, for everyone. Ask in plain language; get real charts, honest
            technicals, business comparisons and earnings reads — then trade, all in one conversation.
          </p>
          <ul className="flex flex-wrap gap-2">
            {CAPS.map((c) => (
              <li key={c} className="border border-border px-3 py-1.5 font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">{c}</li>
            ))}
          </ul>
          <div className="pt-1">
            <Link href="/alpha" className="inline-flex items-center gap-2 border border-signal bg-signal px-7 py-4 font-mono text-[0.8rem] uppercase tracking-[0.14em] text-[#04140a] transition-colors hover:bg-transparent hover:text-signal">
              Launch Alpha <span>↗</span>
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
