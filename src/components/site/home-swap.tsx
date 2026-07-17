import { PhantomSwap } from "@/components/alpha/phantom-swap";

export function HomeSwap() {
  return (
    <section id="trade" className="relative scroll-mt-20 border-t border-border px-5 py-24 sm:px-8 sm:py-32">
      <span className="pointer-events-none absolute right-5 top-10 font-mono text-[0.75rem] uppercase tracking-[0.2em] text-muted-foreground/60 sm:right-8">02 / trade</span>
      <div className="mx-auto grid max-w-7xl items-center gap-12 md:grid-cols-[1fr_auto]">
        <div className="grid gap-6">
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-signal">Trade · non-custodial</span>
          <h2 className="display-tight text-[clamp(2.2rem,5.5vw,4.4rem)] leading-[0.92] text-foreground">
            Buy the on-chain<br />stock market.
          </h2>
          <p className="max-w-md text-pretty text-[1.05rem] leading-relaxed text-muted-foreground">
            Swap tokenized equities — NVDA, AAPL, the Magnificent Seven — straight from your wallet, routed
            for best execution. You sign every trade. Or let Urizen Alpha propose one.
          </p>
        </div>
        <div className="flex w-full justify-center md:w-auto">
          <PhantomSwap defaultBuy="NVDA" />
        </div>
      </div>
    </section>
  );
}
