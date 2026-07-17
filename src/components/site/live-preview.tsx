"use client";

import Link from "next/link";
import { Section } from "@/components/site/section";
import { Panel, AreaChart } from "@/components/app/blocks";
import { usd, price as fmtPrice, pct, compact, shortAddr } from "@/lib/format";
import { ROBINHOOD_CHAIN, RH_UNIV4, URIZEN_TOKEN } from "@/lib/chain";
import type { FundData } from "@/lib/onchain";

const LABELS: Record<string, string> = {
  [RH_UNIV4.poolManager.toLowerCase()]: "Pool",
  [URIZEN_TOKEN.toLowerCase()]: "Treasury",
};

export function LivePreview({ data }: { data: FundData | null }) {
  if (!data) return null;
  const up = data.change24h >= 0;

  const stats = [
    { label: "Price", value: fmtPrice(data.priceUsd) },
    { label: "Market cap", value: usd(data.marketCap) },
    { label: "Liquidity", value: usd(data.liquidityUsd) },
    { label: "Holders", value: data.holders.toLocaleString() },
  ];

  return (
    <Section id="live" className="border-t border-border">
      <div className="mb-8 flex items-end justify-between gap-6">
        <h2 className="display-tight text-[clamp(2rem,5.5vw,4rem)]">
          $URI, <span className="text-signal">on-chain.</span>
        </h2>
        <Link
          href="/fund"
          className="hidden shrink-0 items-center gap-2 border border-white/15 px-5 py-3 font-mono text-[0.78rem] uppercase tracking-[0.12em] text-foreground transition-colors hover:border-signal hover:text-signal sm:inline-flex"
        >
          Open dashboard ↗
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Panel
          eyebrow={`$URI / USD · ${up ? "▲" : "▼"} ${pct(data.change24h)}`}
          title={fmtPrice(data.priceUsd)}
        >
          {data.history.length > 1 ? (
            <AreaChart data={data.history} format={(v) => fmtPrice(v)} />
          ) : (
            <p className="py-10 text-center font-mono text-[0.75rem] uppercase tracking-[0.12em] text-muted-foreground">
              Price history builds as the market trades
            </p>
          )}
        </Panel>

        <Panel eyebrow={`${data.holders} holders`} title="Top holders">
          <ul>
            {data.topHolders.slice(0, 6).map((h, i) => (
              <li key={h.address} className="flex items-center gap-3 border-b border-border/50 py-2.5 font-mono text-[0.78rem] last:border-0">
                <span className="w-4 text-muted-foreground">{i + 1}</span>
                <span className="flex-1 truncate text-foreground">{shortAddr(h.address)}</span>
                {LABELS[h.address.toLowerCase()] && (
                  <span className="border border-signal/40 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.08em] text-signal">
                    {LABELS[h.address.toLowerCase()]}
                  </span>
                )}
                <span className="w-12 text-right tabular-nums text-muted-foreground">{h.pct.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-white/[0.08] bg-white/[0.08] lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-background/70 p-5 backdrop-blur-xl">
            <span className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground">{s.label}</span>
            <div className="mt-2 font-display text-2xl tabular-nums text-foreground">{s.value}</div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground">
        Total supply {compact(data.totalSupply)} · {data.transfersCount} transfers ·{" "}
        <a href={`${ROBINHOOD_CHAIN.blockscout}/token/${data.address}`} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-signal">
          {shortAddr(data.address)}
        </a>
      </p>
    </Section>
  );
}
