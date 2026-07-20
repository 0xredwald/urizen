import Link from "next/link";
import { TerminalShowcase } from "@/components/site/terminal-showcase";

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] items-center overflow-hidden bg-background px-5 pt-28 pb-20 sm:px-8"
    >
      {/* subtle dot-grid texture, fading toward the edges */}
      <div
        className="dots pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          maskImage: "radial-gradient(75% 60% at 50% 40%, #000, transparent 100%)",
          WebkitMaskImage: "radial-gradient(75% 60% at 50% 40%, #000, transparent 100%)",
        }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] lg:gap-10">
        {/* LEFT — the pitch */}
        <div className="flex flex-col items-start text-left">
          <p className="hero-in eyebrow mb-6 text-muted-foreground" style={{ animationDelay: "0.05s" }}>
            TradFi has Bloomberg — now crypto has Urizen
          </p>

          <h1
            className="hero-in display-tight display-black text-balance text-[clamp(1.9rem,5.4vw,3.7rem)] leading-[1.0] text-foreground"
            style={{ animationDelay: "0.12s" }}
          >
            The AI-powered terminal for <span className="text-signal">onchain RWAs.</span>
          </h1>

          <div className="hero-in mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "0.22s" }}>
            <Link
              href="/terminal"
              className="inline-flex items-center justify-center border border-signal bg-signal px-8 py-4 font-mono text-[0.8rem] uppercase tracking-[0.14em] text-[#04140a] transition-colors hover:bg-transparent hover:text-signal"
            >
              Open the terminal ↗
            </Link>
            <Link
              href="/token"
              className="inline-flex items-center justify-center border border-white/20 px-8 py-4 font-mono text-[0.8rem] uppercase tracking-[0.14em] text-foreground transition-colors hover:border-white/50 hover:bg-white/[0.04]"
            >
              $URI token
            </Link>
          </div>
        </div>

        {/* RIGHT — the product, live and in 3D */}
        <div className="hero-in w-full" style={{ animationDelay: "0.3s" }}>
          <TerminalShowcase />
        </div>
      </div>
    </section>
  );
}
