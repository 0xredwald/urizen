import type { Metadata } from "next";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { PageHero } from "@/components/site/page-hero";
import { BrutalLink } from "@/components/site/primitives";
import { ControlRoom } from "@/components/app/control-room";
import { loadFundData, getCandles, getFlywheelLp } from "@/lib/onchain";
import { getBook, getFundTrades, getFundWallets } from "@/lib/fund-wallet";
import { getSignals } from "@/lib/signals";
import { ROBINHOOD_CHAIN, URIZEN_TOKEN } from "@/lib/chain";

export const metadata: Metadata = {
  title: "The fund · live",
  description:
    "URIZEN's live control room — real positions, on-chain execution, the $URI chart, autonomous strategies and the buyback flywheel, straight from Robinhood Chain.",
};

export const revalidate = 30;

export default async function AppPage() {
  const [data, book, trades, candles, signals, wallets, flywheelLp] = await Promise.all([
    loadFundData(),
    getBook(),
    getFundTrades(undefined, 24),
    getCandles("hour", 120),
    getSignals(),
    getFundWallets(),
    getFlywheelLp(),
  ]);

  return (
    <>
      <SiteNav />
      <main>
        <PageHero eyebrow="Live · Robinhood Chain" title="The" accent="fund.">
          Every position, every fill, every mandate — Urizen working in real time.
          Real on-chain state, the $URI chart, and the buyback flywheel, in one board.
        </PageHero>

        <section className="relative px-5 pb-24 sm:px-8">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div
              className="absolute left-1/2 top-0 h-[560px] w-[900px] max-w-[92vw] -translate-x-1/2 rounded-full opacity-70 blur-[120px]"
              style={{ background: "radial-gradient(closest-side, rgba(52,240,3,0.14), transparent)" }}
            />
            <div className="dots absolute inset-0 opacity-[0.3]" />
          </div>

          <div className="mx-auto max-w-7xl">
            {data && book ? (
              <ControlRoom data={data} book={book} trades={trades} candles={candles} signals={signals} wallets={wallets} flywheelLp={flywheelLp} />
            ) : (
              <div className="rounded-[3px] border border-white/[0.08] bg-white/[0.02] p-10 text-center backdrop-blur-xl">
                <p className="font-display text-xl uppercase tracking-tight text-foreground">Fetching on-chain data…</p>
                <a
                  href={`${ROBINHOOD_CHAIN.blockscout}/token/${URIZEN_TOKEN}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex border border-signal px-5 py-3 font-mono text-[0.74rem] uppercase tracking-[0.12em] text-signal"
                >
                  Explorer ↗
                </a>
              </div>
            )}

            {/* back the fund */}
            <div className="mt-14 flex flex-col items-center justify-between gap-6 rounded-[3px] border border-white/[0.08] bg-white/[0.02] p-8 backdrop-blur-xl sm:flex-row">
              <div>
                <p className="font-display text-2xl font-bold uppercase tracking-tight">Own the allocator.</p>
                <p className="mt-2 font-sans text-muted-foreground">
                  One token, wired to the whole book. Profits buy back $URI — real and onchain, on Robinhood Chain.
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <BrutalLink href="/token" variant="signal">Buy $URI</BrutalLink>
                <BrutalLink href={`https://dexscreener.com/${ROBINHOOD_CHAIN.dexscreenerSlug}/${URIZEN_TOKEN}`} variant="ghost">
                  Chart ↗
                </BrutalLink>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
