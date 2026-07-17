import Link from "next/link";
import { UrizenMark } from "@/components/brand/marks";
import { RobinhoodIcon } from "@/components/brand/stock-logos";
import { HeroChart } from "@/components/fx/hero-chart";

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] flex-col items-center justify-start overflow-hidden bg-background px-5 pt-[15vh] pb-16 text-center"
    >
      {/* subtle dot-grid texture, fading toward the edges */}
      <div
        className="dots pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          maskImage: "radial-gradient(70% 55% at 50% 35%, #000, transparent 100%)",
          WebkitMaskImage: "radial-gradient(70% 55% at 50% 35%, #000, transparent 100%)",
        }}
      />
      {/* looping live equity story — clean bottom band */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%]">
        <HeroChart className="h-full w-full" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <span className="hero-in mb-6 block" style={{ animationDelay: "0.05s" }}>
          <UrizenMark className="h-12 w-auto text-signal sm:h-16" />
        </span>

        <h1
          className="hero-in display-tight display-black text-[clamp(2.75rem,13vw,11rem)] leading-[0.82] text-foreground"
          style={{ animationDelay: "0.12s" }}
        >
          URIZEN
        </h1>

        <p
          className="hero-in mt-7 max-w-xs text-balance font-sans text-base leading-relaxed text-muted-foreground sm:mt-8 sm:max-w-xl sm:text-xl"
          style={{ animationDelay: "0.22s" }}
        >
          The first autonomous fund on{" "}
          <span className="inline-flex items-center gap-1.5 align-middle text-foreground">
            <RobinhoodIcon className="inline size-4 text-signal sm:size-5" />
            Robinhood Chain.
          </span>
        </p>

        <div className="hero-in mt-11 flex flex-col items-center gap-3 sm:flex-row" style={{ animationDelay: "0.32s" }}>
          <Link
            href="/fund"
            className="inline-flex items-center justify-center border border-signal bg-signal px-8 py-4 font-mono text-[0.8rem] uppercase tracking-[0.14em] text-[#04140a] transition-colors hover:bg-transparent hover:text-signal"
          >
            View the fund
          </Link>
          <Link
            href="#mechanism"
            className="inline-flex items-center justify-center border border-white/20 px-8 py-4 font-mono text-[0.8rem] uppercase tracking-[0.14em] text-foreground transition-colors hover:border-white/50 hover:bg-white/[0.04]"
          >
            How it works
          </Link>
        </div>
      </div>
    </section>
  );
}
