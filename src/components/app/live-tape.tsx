import { StockLogo } from "@/components/brand/stock-logo";
import { usd, timeAgo } from "@/lib/format";
import { ROBINHOOD_CHAIN } from "@/lib/chain";
import { tradeLabel, type FundTrade } from "@/lib/fund-wallet";

const toneClass = (tone: "up" | "down" | "lp") => (tone === "up" ? "text-signal" : tone === "down" ? "text-[#ff5c5c]" : "text-[#35c9f0]");

/** The tape — the fund's real on-chain fills, newest first, with logos. */
export function LiveTape({ trades }: { trades: FundTrade[] }) {
  const rows = trades.filter((t) => t.kind !== "move" && t.amount > 0).slice(0, 14);

  return (
    <div className="flex h-full flex-col rounded-[4px] border border-white/[0.08] bg-white/[0.015] p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-2xl text-foreground">The tape</h3>
        <span className="flex items-center gap-2 text-base text-signal">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
          </span>
          Live
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Awaiting fills…</div>
      ) : (
        <div className="min-h-0 flex-1 divide-y divide-white/[0.06] overflow-y-auto">
          {rows.map((t, i) => (
            <a
              key={t.hash + i}
              href={`${ROBINHOOD_CHAIN.blockscout}/tx/${t.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 py-2.5 transition-colors hover:opacity-80"
            >
              <StockLogo symbol={t.symbol} size={34} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="font-display text-lg text-foreground">{t.symbol}</div>
                <div className={`text-base ${toneClass(tradeLabel(t).tone)}`}>
                  {tradeLabel(t).verb}
                </div>
              </div>
              <div className="text-right leading-tight">
                <div className="font-display text-lg tabular-nums text-foreground">
                  {t.valueUsd != null ? usd(t.valueUsd, 2) : t.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="text-base text-muted-foreground">{timeAgo(t.timestamp)} ago</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
