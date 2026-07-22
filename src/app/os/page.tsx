import type { Metadata } from "next";
import { OsShell } from "@/components/os/os-shell";

export const metadata: Metadata = {
  title: "URIZEN OS",
  description: "A desktop for on-chain markets — charts, perps, swap, portfolio, and the Urizen agent as windows.",
};

// Full-bleed windowed desktop; owns its own chrome.
export default function OsPage() {
  return <OsShell />;
}
