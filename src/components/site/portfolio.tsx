import { Section } from "@/components/site/section";
import { usd } from "@/lib/format";
import { ROBINHOOD_CHAIN } from "@/lib/chain";
import { FUND_WALLET, type Book } from "@/lib/fund-wallet";

const KIND_LABEL: Record<string, string> = { equity: "Equity", etf: "ETF", crypto: "Crypto", cash: "Cash" };

export function Portfolio({ book }: { book: Book }) {
  const positions = book.positions.filter((p) => p.kind !== "cash" || (p.valueUsd ?? 0) > 1);
  if (positions.length === 0) return null;
  const nav = book.navUsd ?? positions.reduce((s, p) => s + (p.valueUsd ?? 0), 0);

  const stats = [
    { label: "Positions", value: String(book.positions.length) },
    { label: "Tokenized equities", value: String(book.equityCount) },
    { label: "Book value", value: nav ? usd(nav) : "—" },
    { label: "Market", value: "24 / 7" },
  ];

  return (
    <Section id="book" index="02 / BOOK" className="border-t border-border">
      <div className="mb-10 max-w-3xl">
        <span className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-signal">The book</span>
        <h2 className="display-tight mt-3 text-[clamp(2rem,5.5vw,4rem)]">
          Wall Street, <span className="text-signal">on-chain.</span>
        </h2>
        <p className="mt-4 font-mono text-[0.85rem] leading-relaxed text-muted-foreground">
          Every position below is live on Robinhood Chain — tokenized equities the fund holds right now,
          settled onchain, valued at the market. The stock market that never closes, held in one book.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-white/[0.08] bg-white/[0.08] lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-background/70 p-5 backdrop-blur-xl">
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground">{s.label}</span>
            <div className="mt-2 font-display text-2xl tabular-nums text-foreground">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[3px] border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-3">
        {positions.map((p) => {
          const w = nav && p.valueUsd ? (p.valueUsd / nav) * 100 : null;
          return (
            <div key={p.address} className="group relative bg-background/70 p-5 backdrop-blur-xl transition-colors hover:bg-background/90">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-2xl leading-none tracking-tight text-foreground">{p.symbol}</div>
                  <div className="mt-1 truncate font-mono text-[0.72rem] uppercase tracking-[0.1em] text-muted-foreground">{p.name}</div>
                </div>
                <span className="shrink-0 border border-signal/30 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-signal/80">
                  {KIND_LABEL[p.kind] ?? p.kind}
                </span>
              </div>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <div className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">Held</div>
                  <div className="font-display text-lg tabular-nums text-foreground">{p.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">Value</div>
                  <div className="font-display text-lg tabular-nums text-foreground">{p.valueUsd != null ? usd(p.valueUsd, 2) : "—"}</div>
                </div>
              </div>
              {w != null && (
                <div className="mt-4">
                  <div className="h-[3px] w-full bg-white/[0.06]">
                    <div className="h-full bg-signal" style={{ width: `${Math.min(100, w)}%` }} />
                  </div>
                  <div className="mt-1.5 text-right font-mono text-[0.65rem] tabular-nums text-muted-foreground">{w.toFixed(1)}% of book</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
        Real · onchain · verify the book yourself ·{" "}
        <a href={`${ROBINHOOD_CHAIN.blockscout}/address/${FUND_WALLET}`} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-signal">
          verify the book onchain ↗
        </a>
      </p>
    </Section>
  );
}
