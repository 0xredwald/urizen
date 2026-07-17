import { Section } from "@/components/site/section";
import { usd, timeAgo } from "@/lib/format";
import { ROBINHOOD_CHAIN } from "@/lib/chain";
import { tradeLabel, type FundTrade } from "@/lib/fund-wallet";

const toneClass = (tone: "up" | "down" | "lp") => (tone === "up" ? "text-signal" : tone === "down" ? "text-[#ff5c5c]" : "text-[#35c9f0]");

export function LiveTrades({ trades }: { trades: FundTrade[] }) {
  const rows = trades.filter((t) => t.kind !== "move" && t.amount > 0).slice(0, 12);
  if (rows.length === 0) return null;

  return (
    <Section id="tape" index="03 / TAPE" className="border-t border-border">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-signal">Live execution</span>
          <h2 className="display-tight mt-3 text-[clamp(2rem,5.5vw,4rem)]">The tape.</h2>
        </div>
        <div className="flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
          </span>
          Onchain · real-time
        </div>
      </div>

      <div className="overflow-hidden rounded-[3px] border border-white/[0.08]">
        {rows.map((t, i) => (
          <a
            key={t.hash + i}
            href={`${ROBINHOOD_CHAIN.blockscout}/tx/${t.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-white/[0.06] bg-background/60 px-5 py-3.5 backdrop-blur-xl transition-colors last:border-0 hover:bg-background/90 sm:grid-cols-[70px_1fr_auto_auto]"
          >
            <span className={`font-mono text-[0.68rem] uppercase tracking-[0.08em] ${toneClass(tradeLabel(t).tone)}`}>
              {tradeLabel(t).verb}
            </span>
            <span className="min-w-0 truncate">
              <span className="font-display text-base text-foreground">{t.symbol}</span>
              <span className="ml-2 font-mono text-[0.72rem] text-muted-foreground">{t.name}</span>
            </span>
            <span className="hidden text-right font-display tabular-nums text-foreground sm:block">
              {t.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              {t.valueUsd != null && <span className="ml-2 font-mono text-[0.72rem] text-muted-foreground">{usd(t.valueUsd, 2)}</span>}
            </span>
            <span className="text-right font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted-foreground">{timeAgo(t.timestamp)}</span>
          </a>
        ))}
      </div>
    </Section>
  );
}
