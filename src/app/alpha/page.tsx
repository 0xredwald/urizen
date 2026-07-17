import type { Metadata } from "next";
import { AlphaChat } from "@/components/alpha/alpha-chat";

export const metadata: Metadata = {
  title: "Urizen Alpha · AI equity research",
  description:
    "Meet Urizen Alpha — the first AI equity research agent on Robinhood Chain. Institutional-grade stock research for everyone: research companies, analyse charts, build strategies, compare businesses, explain earnings, and trade. Just ask.",
};

export default function AlphaPage() {
  return <AlphaChat />;
}
