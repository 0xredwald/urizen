import type { Metadata } from "next";
import { TerminalShell } from "@/components/terminal/terminal-shell";

export const metadata: Metadata = {
  title: "Terminal · URIZEN",
  description: "An agent-driven trading terminal — markets, charts, and the Horizon agent, on Robinhood Chain.",
};

// The terminal is a full-bleed client surface; it owns its own chrome (no site nav/footer).
export default function TerminalPage() {
  return <TerminalShell />;
}
