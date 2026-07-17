import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { PageHero } from "@/components/site/page-hero";
import { Section } from "@/components/site/section";
import { Reveal } from "@/components/fx/reveal";
import { BrutalLink, Eyebrow } from "@/components/site/primitives";
import { BlakePlate } from "@/components/site/blake-plate";
import { UrizenMark } from "@/components/brand/marks";
import { PriceChart } from "@/components/app/price-chart";
import { URIZEN_TOKEN, ROBINHOOD_CHAIN } from "@/lib/chain";
import { loadFundData, getCandles } from "@/lib/onchain";
import { shortAddr } from "@/lib/format";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "$URI · the token",
  description:
    "$URI is live on Robinhood Chain. It buys itself back from the fund's real profits and fees. Non-custodial.",
};

const DEX = `https://dexscreener.com/${ROBINHOOD_CHAIN.dexscreenerSlug}/${URIZEN_TOKEN}`;

const TOKENOMICS = [
  { k: "Ticker", v: "$URI" },
  { k: "Chain", v: "Robinhood Chain" },
  { k: "Supply", v: "100B" },
  { k: "Venue", v: "Uniswap · WETH" },
  { k: "Custody", v: "Non-custodial" },
  { k: "Contract", v: shortAddr(URIZEN_TOKEN) },
];

const BUY_STEPS = [
  { n: "01", t: "Wallet on Robinhood Chain", d: "Bring an EVM wallet funded with ETH on Robinhood Chain." },
  { n: "02", t: "Swap for $URI", d: "Trade the URI/WETH pool on any Robinhood Chain DEX." },
  { n: "03", t: "Hold the allocator", d: "Buybacks from real profit + fees accrue to holders." },
];

export default async function TokenPage() {
  const [data, candles] = await Promise.all([loadFundData(), getCandles("hour", 120)]);

  return (
    <>
      <SiteNav />
      <main>
        <PageHero eyebrow="The token" title="$URI">
          One token, wired to one fund. $URI buys itself back from the
          allocator&apos;s real profits and fees. Performance accrues to holders,
          not to a manager.
        </PageHero>

        {/* live chart */}
        {data && candles.length > 1 && (
          <Section className="border-t border-border">
            <div className="h-[400px]">
              <PriceChart
                candles={candles}
                priceUsd={data.priceUsd}
                change24h={data.change24h}
                volume24h={data.volume24h}
              />
            </div>
          </Section>
        )}

        {/* value accrual */}
        <Section className="border-t border-border">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal blur className="order-2 lg:order-1">
              <div className="scanlines relative grid aspect-square place-items-center overflow-hidden border border-border bg-[#0c0c0e]">
                <div className="dots absolute inset-0 opacity-30" />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="anim-spin-slow size-[70%] rounded-full border border-dashed border-signal/30" />
                </div>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="anim-spin-rev size-[46%] rounded-full border border-border" />
                </div>
                <UrizenMark className="anim-pulse-glow relative h-20 w-auto text-signal" />
              </div>
            </Reveal>
            <div className="order-1 lg:order-2">
              <Reveal>
                <Eyebrow className="mb-7">Value accrual</Eyebrow>
              </Reveal>
              <Reveal delay={0.08}>
                <h2 className="display-tight display-black text-[clamp(2.2rem,6vw,4.6rem)]">
                  It buys
                  <br />
                  <span className="text-signal">itself back.</span>
                </h2>
              </Reveal>
              <Reveal delay={0.16}>
                <p className="mt-7 font-sans text-lg leading-relaxed text-muted-foreground">
                  The fund invests onchain and in public on Robinhood Chain.
                  Realised profit and protocol fees are routed into continuous
                  buybacks of $URI, a closed loop between the strategy&apos;s
                  performance and the token.
                </p>
              </Reveal>
              <Reveal delay={0.24} className="mt-8">
                <BrutalLink href="/#mechanism" variant="ghost">
                  See the loop
                </BrutalLink>
              </Reveal>
            </div>
          </div>
        </Section>

        <Section className="border-t border-border">
          <div className="relative overflow-hidden rounded-[3px]">
            <BlakePlate
              src="/img/blake-newton.webp"
              alt="William Blake, Newton, measuring with a compass"
              className="aspect-[16/8] sm:aspect-[16/6]"
            />
            <div className="pointer-events-none absolute inset-0 flex items-end p-6 sm:p-10">
              <p className="display-tight text-[clamp(1.5rem,4vw,3rem)] text-foreground">
                Measured <span className="text-signal">by design.</span>
              </p>
            </div>
          </div>
        </Section>

        {/* tokenomics */}
        <Section className="border-t border-border bg-card/30">
          <div className="max-w-2xl">
            <Reveal>
              <Eyebrow className="mb-7">Tokenomics</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="display-tight display-black text-[clamp(2rem,5vw,3.6rem)]">
                Honest by <span className="text-signal">default.</span>
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.14} className="mt-10">
            <dl className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {TOKENOMICS.map((t) => (
                <div key={t.k} className="bg-card px-6 py-7">
                  <dt className="font-mono text-[0.75rem] uppercase tracking-[0.14em] text-muted-foreground">
                    {t.k}
                  </dt>
                  <dd className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-foreground">
                    {t.v}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 flex items-center gap-2 font-mono text-[0.74rem] uppercase tracking-[0.12em] text-muted-foreground">
              <span className="live-dot" aria-hidden />
              Live ·{" "}
              <a href={`${ROBINHOOD_CHAIN.blockscout}/token/${URIZEN_TOKEN}`} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-signal">
                {URIZEN_TOKEN}
              </a>
            </p>
          </Reveal>
        </Section>

        {/* how to buy */}
        <Section className="border-t border-border">
          <div className="max-w-2xl">
            <Reveal>
              <Eyebrow className="mb-7">How to buy</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="display-tight display-black text-[clamp(2rem,5vw,3.6rem)]">
                Three <span className="text-signal">steps.</span>
              </h2>
            </Reveal>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
            {BUY_STEPS.map((s, i) => (
              <Reveal key={s.n} delay={0.1 + i * 0.1} className="bg-card">
                <div className="group h-full p-8 transition-colors hover:bg-concrete">
                  <span className="font-display text-3xl font-bold text-signal">{s.n}</span>
                  <h3 className="mt-6 font-display text-lg font-bold uppercase tracking-tight">
                    {s.t}
                  </h3>
                  <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">
                    {s.d}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.3} className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <BrutalLink href={DEX} variant="signal">
              Trade $URI ↗
            </BrutalLink>
            <BrutalLink href="https://x.com/urizenfund" variant="ghost">
              Follow @urizenfund
            </BrutalLink>
          </Reveal>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
