import Link from "next/link";
import { UrizenMark } from "@/components/brand/marks";

const COLS = [
  {
    head: "Fund",
    links: [
      { label: "The fund", href: "/#agent" },      { label: "Mechanism", href: "/#mechanism" },
      { label: "$URI token", href: "/token" },
    ],
  },
  {
    head: "Platform",
    links: [
      { label: "CTRL", href: "https://ctrl.build/urizen" },
      { label: "Launch app", href: "/fund" },
      { label: "Robinhood Chain", href: "https://robinhood.com" },
    ],
  },
  {
    head: "Connect",
    links: [
      { label: "X · @urizenfund", href: "https://x.com/urizenfund" },
      { label: "GitHub", href: "https://github.com/0xredwald/urizen" },
      { label: "Telegram", href: "https://t.me/urizenalpha" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/30 px-5 pt-16 pb-10 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,0.9fr)]">
          <div>
            <Link href="#top" className="inline-flex items-center gap-3">
              <UrizenMark className="h-8 w-auto text-signal" />
              <span className="font-display text-xl uppercase tracking-[0.05em]">
                Urizen
              </span>
            </Link>
            <p className="mt-5 max-w-xs font-sans text-sm leading-relaxed text-muted-foreground">
              The first autonomous onchain fund on Robinhood Chain, built
              on CTRL.
            </p>
            <p className="mt-6 font-mono text-[0.74rem] uppercase tracking-[0.16em] text-muted-foreground">
              The first autonomous fund on Robinhood Chain.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.head}>
              <h3 className="font-mono text-[0.75rem] uppercase tracking-[0.2em] text-muted-foreground">
                {col.head}
              </h3>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="font-sans text-sm text-foreground/80 transition-colors hover:text-signal"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border pt-7 sm:flex-row sm:items-center">
          <p className="font-mono text-[0.74rem] uppercase tracking-[0.14em] text-muted-foreground">
            © {new Date().getFullYear()} Urizen
          </p>
          <p className="font-mono text-[0.74rem] uppercase tracking-[0.14em] text-muted-foreground">
            The first autonomous fund on Robinhood Chain
          </p>
        </div>
      </div>
    </footer>
  );
}
