"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UrizenMark } from "@/components/brand/marks";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href?: string; children?: { label: string; href: string }[] };
const LINKS: NavItem[] = [
  { label: "Alpha", href: "/alpha" },
  { label: "Fund", children: [{ label: "The fund", href: "/fund" }, { label: "$URI token", href: "/token" }] },
  { label: "Skill", href: "/skill" },
  { label: "Docs", href: "/docs" },
  { label: "x402", href: "/x402" },
];

export function SiteNav() {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!onHome) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onHome]);

  // dark theme throughout — always light ink
  const ink = "text-foreground";
  const muted = "text-muted-foreground";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-[4.75rem] max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className={cn("group flex shrink-0 items-center gap-2.5", ink)}>
          <UrizenMark className="h-6 w-auto text-signal transition-transform duration-300 group-hover:scale-110" />
          <span className="font-display text-base font-bold uppercase tracking-[0.04em] sm:text-lg">
            Urizen
          </span>
        </Link>

        <div className="hidden items-center gap-9 md:flex">
          {LINKS.map((l) =>
            l.children ? (
              <div key={l.label} className="group relative">
                <button className={cn("flex items-center gap-1 font-mono text-[0.82rem] uppercase tracking-[0.1em] transition-colors group-hover:text-signal", muted)}>
                  {l.label}<span className="text-[0.6rem] transition-transform group-hover:translate-y-0.5">▾</span>
                </button>
                <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100">
                  <div className="min-w-[168px] border border-border bg-background/95 p-1.5 backdrop-blur-md">
                    {l.children.map((c) => (
                      <Link key={c.href} href={c.href} className="block px-3 py-2 font-mono text-[0.76rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-signal/10 hover:text-signal">
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Link key={l.href} href={l.href!} className={cn("font-mono text-[0.82rem] uppercase tracking-[0.1em] transition-colors hover:text-signal", muted)}>
                {l.label}
              </Link>
            ),
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="https://x.com/urizenfund"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Urizen on X"
            className="hidden size-9 shrink-0 place-items-center border border-white/15 text-foreground transition-colors hover:border-signal hover:text-signal sm:grid"
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
              <path d="M18.9 1.5h3.3l-7.2 8.2 8.5 11.3h-6.7l-5.2-6.9-6 6.9H1.6l7.7-8.8L1.1 1.5h6.9l4.7 6.3 6.2-6.3Zm-1.2 18h1.8L7.1 3.3H5.2L17.7 19.5Z" />
            </svg>
          </Link>
          <Link
            href="/alpha"
            className="group inline-flex shrink-0 items-center gap-2 border border-signal/50 bg-signal/10 px-3.5 py-2.5 font-mono text-[0.8rem] uppercase tracking-[0.1em] text-signal transition-colors hover:bg-signal/20 sm:px-5"
          >
            <span className="sm:hidden">Alpha</span>
            <span className="hidden sm:inline">Launch Alpha</span>
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">↗</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
