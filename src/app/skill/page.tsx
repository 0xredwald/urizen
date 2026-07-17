import type { Metadata } from "next";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { UnifiedSkill } from "@/components/skill/unified-skill";

export const metadata: Metadata = {
  title: "The Urizen skill",
  description:
    "One portable, keyless skill. Everything Urizen does — AI equity research, non-custodial swaps, and the autonomous fund's live state — as one skill any agent can read, run and act on. On Robinhood Chain.",
};

export default function SkillPage() {
  return (
    <>
      <SiteNav />
      <main>
        <UnifiedSkill />
      </main>
      <SiteFooter />
    </>
  );
}
