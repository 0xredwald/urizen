import type { Metadata } from "next";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { Docs } from "@/components/docs/docs";

export const metadata: Metadata = {
  title: "Docs · the Urizen API",
  description:
    "The public, keyless Urizen API: real market-data OHLC, best-route swap quotes on Robinhood Chain, and the autonomous fund's live state. Non-custodial by design.",
};

export default function DocsPage() {
  return (
    <>
      <SiteNav />
      <main>
        <Docs />
      </main>
      <SiteFooter />
    </>
  );
}
