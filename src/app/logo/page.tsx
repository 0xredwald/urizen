import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { UrizenMark } from "@/components/brand/marks";

export const metadata: Metadata = {
  title: "Logo",
  description: "The URIZEN mark — download the green logo in SVG and PNG.",
};

export default function LogoPage() {
  return (
    <>
      <SiteNav />
      <main className="px-5 pt-32 pb-24 sm:px-8 sm:pt-40">
        <div className="mx-auto max-w-4xl">
          <span className="eyebrow">Brand · Logo</span>
          <h1 className="mt-4 display-tight display-black text-[clamp(2.1rem,8vw,5rem)]">
            The <span className="text-signal">mark.</span>
          </h1>

          {/* the logo, centered on the brand surface */}
          <div
            className="mt-10 grid place-items-center overflow-hidden rounded-[4px] border border-white/[0.08] bg-background py-20"
            style={{
              backgroundImage:
                "radial-gradient(60% 55% at 50% 45%, rgba(52,240,3,0.10), transparent 70%)",
            }}
          >
            <UrizenMark className="h-40 w-auto text-signal drop-shadow-[0_20px_60px_rgba(52,240,3,0.35)] sm:h-56" />
          </div>

          {/* downloads */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a
              href="/urizen-mark-green.svg"
              download
              className="group flex items-center justify-between border border-white/15 px-6 py-5 transition-colors hover:border-signal"
            >
              <span>
                <span className="font-display text-lg font-bold uppercase tracking-tight text-foreground">
                  SVG
                </span>
                <span className="mt-1 block font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground">
                  Vector · #34F003
                </span>
              </span>
              <span className="font-mono text-signal transition-transform group-hover:translate-x-0.5">
                ↓
              </span>
            </a>
            <a
              href="/img/mark-green.png"
              download="urizen-mark-green.png"
              className="group flex items-center justify-between border border-white/15 px-6 py-5 transition-colors hover:border-signal"
            >
              <span>
                <span className="font-display text-lg font-bold uppercase tracking-tight text-foreground">
                  PNG
                </span>
                <span className="mt-1 block font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground">
                  512×512 · transparent
                </span>
              </span>
              <span className="font-mono text-signal transition-transform group-hover:translate-x-0.5">
                ↓
              </span>
            </a>
          </div>

          {/* palette + usage */}
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex items-center gap-4 border border-white/[0.08] p-5">
              <span className="size-12 rounded-[3px]" style={{ background: "#34F003" }} />
              <span>
                <span className="block font-mono text-sm text-foreground">#34F003</span>
                <span className="block font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground">
                  Signal green
                </span>
              </span>
            </div>
            <p className="font-sans text-sm leading-relaxed text-muted-foreground">
              Use the mark in signal green on a near-black surface, or in solid
              black/white where colour isn&apos;t available. Keep clear space
              around it equal to the width of one stroke. Don&apos;t recolour,
              stretch, or add effects.
            </p>
          </div>

          <div className="mt-10">
            <Link
              href="/"
              className="font-mono text-[0.78rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-signal"
            >
              ← Back to site
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
