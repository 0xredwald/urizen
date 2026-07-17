import { StockLogo } from "@/components/brand/stock-logo";
import { pct } from "@/lib/format";
import type { Signal, Stance } from "@/lib/signals";

const STANCE: Record<Stance, string> = {
  Accumulate: "text-signal border-signal/40 bg-signal/[0.08]",
  Hold: "text-muted-foreground border-white/15 bg-white/[0.03]",
  Trim: "text-[#ff5c5c] border-[#ff5c5c]/40 bg-[#ff5c5c]/[0.06]",
};

/** Compact signal desk — the momentum/trend reads behind the fund's own book.
 *  Secondary to holdings + strategy; tied to the names the fund trades. */
export function Signals({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) return null;

  return (
    <div className="rounded-[4px] border border-white/[0.08] bg-white/[0.015] p-5 backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl text-foreground">The reads behind the book</h3>
        <span className="text-sm text-muted-foreground">momentum · trend · RSI on the fund&apos;s universe</span>
      </div>

      <div className="divide-y divide-white/[0.06]">
        {signals.map((s) => (
          <div key={s.symbol} className="flex items-center gap-3 py-2.5">
            <StockLogo symbol={s.symbol} size={30} />
            <div className="w-16 shrink-0">
              <div className="font-display text-base leading-none text-foreground">{s.symbol}</div>
            </div>
            <div className="w-24 shrink-0 text-right font-display text-base tabular-nums text-foreground">
              ${s.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div className={`hidden w-20 shrink-0 text-right tabular-nums sm:block ${s.momentum >= 0 ? "text-signal" : "text-[#ff5c5c]"}`}>
              {pct(s.momentum, 1)}
            </div>
            <div className="hidden w-16 shrink-0 text-right text-muted-foreground md:block">
              RSI {s.rsi}
            </div>
            <div className="ml-auto shrink-0">
              <span className={`rounded-full border px-2.5 py-0.5 text-sm ${STANCE[s.stance]}`}>{s.stance}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
