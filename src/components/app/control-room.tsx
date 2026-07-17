import { PriceChart } from "@/components/app/price-chart";
import { LiveTape } from "@/components/app/live-tape";
import { Signals } from "@/components/app/signals";
import { FlywheelFlow } from "@/components/app/flywheel-flow";
import { Buyback } from "@/components/app/buyback";
import { StockLogo } from "@/components/brand/stock-logo";
import { STRATEGIES } from "@/lib/strategies";
import { usd, compact, pct, shortAddr } from "@/lib/format";
import { ROBINHOOD_CHAIN } from "@/lib/chain";
import type { FundData, Candle, FlywheelLp } from "@/lib/onchain";
import type { Book, FundTrade } from "@/lib/fund-wallet";
import type { Signal } from "@/lib/signals";

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  const color = tone === "up" ? "text-signal" : tone === "down" ? "text-[#ff5c5c]" : "text-foreground";
  return (
    <div className="bg-[#0b0b0d] px-5 py-4">
      <div className="text-base text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

export function ControlRoom({
  data,
  trades,
  candles,
  signals,
  wallets,
  flywheelLp,
}: {
  data: FundData;
  book: Book;
  trades: FundTrade[];
  candles: Candle[];
  signals: Signal[];
  wallets: { wallet: string; book: Book }[];
  flywheelLp: FlywheelLp | null;
}) {
  const nav = wallets.reduce((s, w) => s + (w.book.navUsd ?? 0), 0);

  const kpis: { label: string; value: string; tone?: "up" | "down" }[] = [
    { label: "Price", value: data.priceUsd ? `$${data.priceUsd < 0.01 ? data.priceUsd.toExponential(2) : data.priceUsd.toFixed(4)}` : "—" },
    { label: "24h", value: pct(data.change24h), tone: data.change24h >= 0 ? "up" : "down" },
    { label: "Market cap", value: data.marketCap ? `$${compact(data.marketCap)}` : "—" },
    { label: "$URI liquidity", value: data.liquidityUsd ? `$${compact(data.liquidityUsd)}` : "—" },
    { label: "Book NAV", value: nav ? usd(nav) : "—" },
    { label: "Holders", value: data.holders ? compact(data.holders) : "—" },
  ];

  return (
    <div className="space-y-14">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-white/[0.08] bg-white/[0.08] sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      {/* 1 — strategies, front and center: the flagship $URI flywheel */}
      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl text-foreground">Strategies</h2>
          <span className="rounded-full border border-signal/40 px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-signal">
            CASHCAT / SPCX LP{flywheelLp ? ` · $${compact(flywheelLp.reserveUsd)}` : ""}
          </span>
        </div>
        <div className="h-[460px]">
          <FlywheelFlow lpUsd={flywheelLp?.reserveUsd ?? null} />
        </div>
      </div>

      {/* 2 — the mandates */}
      <div className="rounded-[4px] border border-white/[0.08] bg-white/[0.015] p-6 backdrop-blur-xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl text-foreground">Mandates</h2>
        </div>
        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
          {STRATEGIES.map((s) => (
            <div key={s.id} className="flex items-center gap-4 border-b border-white/[0.06] py-4">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.status === "live" ? "bg-signal" : "bg-white/25"}`} />
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg leading-tight text-foreground">{s.name}</div>
                <div className="text-base text-muted-foreground">{s.cadence} · {s.allocationPct}% sleeve</div>
              </div>
              <div className="flex shrink-0 -space-x-2">
                {s.targets.slice(0, 4).map((t) => (
                  <StockLogo key={t} symbol={t} size={30} className="ring-2 ring-[#0b0b0d]" />
                ))}
              </div>
            </div>
          ))}
          {/* placeholder — the roster grows */}
          <div className="flex items-center gap-4 border-b border-dashed border-white/[0.10] py-4 opacity-70">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/25" />
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg leading-tight text-muted-foreground">More strategies</div>
              <div className="text-base text-muted-foreground">appearing soon</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 — price + tape */}
      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="h-[340px]">
          <PriceChart candles={candles} priceUsd={data.priceUsd} change24h={data.change24h} volume24h={data.volume24h} />
        </div>
        <div className="h-[340px]">
          <LiveTape trades={trades} />
        </div>
      </div>

      {/* 4 — the two wallets the fund controls */}
      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl text-foreground">Wallets</h2>
          <span className="text-base text-muted-foreground">Two wallets controlled by the fund</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {wallets.map(({ wallet, book: wb }, i) => (
            <div key={wallet} className="rounded-[4px] border border-white/[0.08] bg-white/[0.015] p-5 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-lg text-foreground">{i === 0 ? "Trading" : "Treasury"}</div>
                  <a href={`${ROBINHOOD_CHAIN.blockscout}/address/${wallet}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[0.78rem] text-muted-foreground transition-colors hover:text-signal">
                    {shortAddr(wallet)} ↗
                  </a>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Value</div>
                  <div className="font-display text-2xl tabular-nums text-signal">{wb.navUsd ? usd(wb.navUsd) : "—"}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-1.5 border-t border-white/[0.06] pt-4">
                {wb.positions.slice(0, 6).map((p) => (
                  <div key={p.address} className="flex items-center gap-2.5">
                    <StockLogo symbol={p.symbol} size={22} />
                    <span className="font-mono text-[13px] text-foreground">{p.symbol}</span>
                    <span className="ml-auto tabular-nums text-[13px] text-foreground/80">{p.amount.toLocaleString(undefined, { maximumFractionDigits: p.amount < 1 ? 4 : 2 })}</span>
                    <span className="w-20 shrink-0 text-right tabular-nums text-[12px] text-muted-foreground">{p.valueUsd ? usd(p.valueUsd) : "—"}</span>
                  </div>
                ))}
                {wb.positions.length === 0 && <div className="text-[13px] text-muted-foreground">No holdings yet.</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5 — reads + buyback (secondary) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Signals signals={signals} />
        <Buyback />
      </div>
    </div>
  );
}
