import { StockLogo } from "@/components/brand/stock-logo";
import { usd } from "@/lib/format";
import { ROBINHOOD_CHAIN } from "@/lib/chain";
import { FUND_WALLET, type Book } from "@/lib/fund-wallet";

/** The book — every tokenized position the fund holds, big and logo-forward. */
export function LiveBook({ book }: { book: Book }) {
  const positions = book.positions
    .filter((p) => p.kind !== "cash" || (p.valueUsd ?? 0) > 1)
    .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  const nav = book.navUsd ?? positions.reduce((s, p) => s + (p.valueUsd ?? 0), 0);
  if (positions.length === 0) return null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-3xl text-foreground">The book</h2>
        <div className="flex items-baseline gap-6">
          <span className="font-display text-3xl tabular-nums text-foreground">{usd(nav)}</span>
          <span className="text-lg text-muted-foreground">{positions.length} holdings</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {positions.map((p) => {
          const w = nav && p.valueUsd ? (p.valueUsd / nav) * 100 : null;
          return (
            <div key={p.address} className="rounded-[4px] border border-white/[0.08] bg-white/[0.02] p-5">
              <div className="flex items-center gap-4">
                <StockLogo symbol={p.symbol} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-2xl leading-none text-foreground">{p.symbol}</div>
                  <div className="mt-1 truncate text-base text-muted-foreground">{p.name.replace(/ ?[•·].*/, "")}</div>
                </div>
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div className="font-display text-2xl tabular-nums text-foreground">
                  {p.valueUsd != null ? usd(p.valueUsd, 2) : "—"}
                </div>
                {w != null && <div className="text-lg tabular-nums text-signal">{w.toFixed(0)}%</div>}
              </div>
              {w != null && (
                <div className="mt-3 h-1.5 w-full rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-signal" style={{ width: `${Math.min(100, w)}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <a
        href={`${ROBINHOOD_CHAIN.blockscout}/address/${FUND_WALLET}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-block text-base text-muted-foreground transition-colors hover:text-signal"
      >
        Real &amp; onchain — verify the book yourself ↗
      </a>
    </div>
  );
}
