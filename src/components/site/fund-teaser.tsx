import Link from "next/link";
import { Section } from "@/components/site/section";
import { StockLogo } from "@/components/brand/stock-logo";
import { usd, timeAgo } from "@/lib/format";
import { tradeLabel, type Book, type FundTrade } from "@/lib/fund-wallet";

/** Home-page teaser: one compact strip proving the fund is live, that funnels
 *  to the full control room at /app. */
export function FundTeaser({ book, trades }: { book: Book; trades: FundTrade[] }) {
  const positions = book.positions
    .filter((p) => (p.valueUsd ?? 0) > 1)
    .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  const nav = book.navUsd ?? 0;
  const fills = trades.filter((t) => t.kind !== "move" && t.amount > 0).slice(0, 3);
  if (positions.length === 0) return null;

  return (
    <Section id="live" index="02 / LIVE" className="border-t border-border">
      <div className="rounded-[4px] border border-white/[0.08] bg-white/[0.015] p-8 backdrop-blur-xl sm:p-10">
        <div className="flex items-center gap-2.5 text-signal">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-signal" />
          </span>
          <span className="text-base">The fund is live</span>
        </div>

        <h2 className="display-tight mt-5 text-[clamp(1.9rem,4.5vw,3.2rem)]">
          An autonomous book of the <span className="text-signal">on-chain stock market.</span>
        </h2>

        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-5">
          {positions.slice(0, 6).map((p) => (
            <div key={p.address} className="flex items-center gap-3">
              <StockLogo symbol={p.symbol} size={40} />
              <div>
                <div className="font-display text-base leading-none text-foreground">{p.symbol}</div>
                <div className="mt-1 text-sm tabular-nums text-muted-foreground">
                  {p.valueUsd != null ? usd(p.valueUsd, 0) : "—"}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-9 flex flex-col gap-5 border-t border-white/[0.06] pt-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-base text-muted-foreground">
            <span className="text-foreground">
              {usd(nav)} <span className="text-muted-foreground">book value</span>
            </span>
            {fills[0] && (
              <span>
                <span className={tradeLabel(fills[0]).tone === "up" ? "text-signal" : tradeLabel(fills[0]).tone === "down" ? "text-[#ff5c5c]" : "text-[#35c9f0]"}>
                  {tradeLabel(fills[0]).verb} {fills[0].symbol}
                </span>{" "}
                {timeAgo(fills[0].timestamp)} ago
              </span>
            )}
          </div>
          <Link
            href="/fund"
            className="group inline-flex shrink-0 items-center gap-2 border border-signal bg-signal/[0.06] px-6 py-3.5 text-base text-signal transition-colors hover:bg-signal hover:text-background"
          >
            View the fund
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </div>
    </Section>
  );
}
