import { SiteNav } from "@/components/site/site-nav";
import { Hero } from "@/components/site/hero";
import { AlphaBand } from "@/components/site/alpha-band";
import { HomeSwap } from "@/components/site/home-swap";
import { LivePreview } from "@/components/site/live-preview";
import { Mechanism } from "@/components/site/mechanism";
import { BlakeBand } from "@/components/site/blake-band";
import { Fund } from "@/components/site/fund";
import { Cta } from "@/components/site/cta";
import { SiteFooter } from "@/components/site/site-footer";
import { loadFundData } from "@/lib/onchain";

export const revalidate = 30;

export default async function Home() {
  const data = await loadFundData();
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <AlphaBand />
        <HomeSwap />
        <LivePreview data={data} />
        <Mechanism />
        <BlakeBand />
        <Fund />
        <Cta />
      </main>
      <SiteFooter />
    </>
  );
}
