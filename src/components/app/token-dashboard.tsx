"use client";

import { Panel, AreaChart } from "@/components/app/blocks";
import { usd, compact, pct, price as fmtPrice, shortAddr, timeAgo } from "@/lib/format";
import { ROBINHOOD_CHAIN, RH_UNIV4, URIZEN_TOKEN } from "@/lib/chain";
import type { FundData } from "@/lib/onchain";

const LABELS: Record<string, string> = {
  [RH_UNIV4.poolManager.toLowerCase()]: "Liquidity pool",
  [URIZEN_TOKEN.toLowerCase()]: "Treasury",
  "0x000000000000000000000000000000000000dead": "Burn",
};

function Kpi({ label, value, accent, sub }: { label: string; value: React.ReactNode; accent?: boolean; sub?: string }) {
  return (
    <div className="bg-white/[0.015] p-5 backdrop-blur-xl">
      <div className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-2xl tabular-nums ${accent ? "text-signal" : "text-foreground"}`}>{value}</div>
      {sub && <div className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function TokenDashboard({ data }: { data: FundData }) {
  const up = data.change24h >= 0;
  const inPool = data.totalSupply - data.circulating;

  return (
    <div className="space-y-6">
      {/* live price header */}
      <Panel>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow inline-flex items-center gap-2.5">
              <span className="live-dot" aria-hidden />
              ${data.symbol} · live on Robinhood Chain
            </span>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-display text-4xl tabular-nums text-signal sm:text-5xl">{fmtPrice(data.priceUsd)}</span>
              <span className={`font-mono text-sm ${up ? "text-signal" : "text-muted-foreground"}`}>
                {up ? "▲" : "▼"} {pct(data.change24h)} 24h
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={`https://dexscreener.com/${ROBINHOOD_CHAIN.dexscreenerSlug}/${data.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-signal bg-signal px-5 py-3 font-mono text-[0.74rem] uppercase tracking-[0.12em] text-[#04140a] transition-colors hover:bg-transparent hover:text-signal"
            >
              Trade ↗
            </a>
            <a
              href={`${ROBINHOOD_CHAIN.blockscout}/token/${data.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-white/15 px-5 py-3 font-mono text-[0.74rem] uppercase tracking-[0.12em] text-foreground transition-colors hover:border-signal hover:text-signal"
            >
              Explorer ↗
            </a>
          </div>
        </div>
        {data.history.length > 1 && (
          <div className="mt-6">
            <AreaChart data={data.history} format={(v) => fmtPrice(v)} />
          </div>
        )}
      </Panel>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-white/[0.08] bg-white/[0.08] lg:grid-cols-3">
        <Kpi label="Market cap" accent value={usd(data.marketCap)} />
        <Kpi label="FDV" value={usd(data.fdv)} />
        <Kpi label="Liquidity" value={usd(data.liquidityUsd)} />
        <Kpi label="24h volume" value={usd(data.volume24h)} />
        <Kpi label="Holders" value={data.holders.toLocaleString()} />
        <Kpi label="Transfers" value={data.transfersCount.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* supply */}
        <Panel eyebrow={`Total supply · ${compact(data.totalSupply)}`} title="Supply">
          <div className="space-y-4">
            {[
              { name: "Circulating", v: data.circulating, tone: "signal" as const },
              { name: "In liquidity pool", v: inPool, tone: "muted" as const },
            ].map((s) => (
              <div key={s.name}>
                <div className="mb-1.5 flex items-baseline justify-between font-mono text-[0.76rem] uppercase tracking-[0.1em]">
                  <span className="text-foreground">{s.name}</span>
                  <span className="text-muted-foreground">
                    {compact(s.v)} · {data.totalSupply > 0 ? ((s.v / data.totalSupply) * 100).toFixed(1) : "0"}%
                  </span>
                </div>
                <div className="h-2.5 w-full bg-border/60">
                  <div
                    className={s.tone === "signal" ? "h-full bg-signal" : "h-full bg-foreground/60"}
                    style={{
                      width: `${data.totalSupply > 0 ? (s.v / data.totalSupply) * 100 : 0}%`,
                      boxShadow: s.tone === "signal" ? "0 0 12px rgba(52,240,3,0.4)" : undefined,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* top holders */}
        <Panel eyebrow={`${data.holders} holders`} title="Top holders">
          <ul>
            {data.topHolders.slice(0, 8).map((h, i) => {
              const label = LABELS[h.address.toLowerCase()];
              return (
                <li key={h.address} className="flex items-center gap-3 border-b border-border/50 py-2.5 font-mono text-[0.8rem] last:border-0">
                  <span className="w-5 text-muted-foreground">{i + 1}</span>
                  <a
                    href={`${ROBINHOOD_CHAIN.blockscout}/address/${h.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 truncate text-foreground transition-colors hover:text-signal"
                  >
                    {shortAddr(h.address)}
                  </a>
                  {label && (
                    <span className="shrink-0 border border-signal/40 px-1.5 py-0.5 text-[0.62rem] uppercase tracking-[0.08em] text-signal">
                      {label}
                    </span>
                  )}
                  <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">{h.pct.toFixed(1)}%</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {/* recent transfers */}
      <Panel eyebrow="On-chain" title="Recent transfers" className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse sm:min-w-[520px]">
            <thead>
              <tr className="border-b border-border font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-5 py-3 text-left font-normal">Method</th>
                <th className="px-5 py-3 text-left font-normal">From</th>
                <th className="px-5 py-3 text-left font-normal">To</th>
                <th className="px-5 py-3 text-right font-normal">Amount {data.symbol}</th>
                <th className="px-5 py-3 text-right font-normal">When</th>
              </tr>
            </thead>
            <tbody>
              {data.transfers.slice(0, 12).map((t, i) => (
                <tr key={i} className="border-b border-border/50 font-mono text-[0.8rem] last:border-0">
                  <td className="px-5 py-3 uppercase tracking-[0.06em] text-signal">{t.method ?? "transfer"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{LABELS[t.from.toLowerCase()] ?? shortAddr(t.from)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{LABELS[t.to.toLowerCase()] ?? shortAddr(t.to)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-foreground">{compact(t.amount)}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">
                    <a href={`${ROBINHOOD_CHAIN.blockscout}/tx/${t.hash}`} target="_blank" rel="noopener noreferrer" className="hover:text-signal">
                      {timeAgo(t.timestamp)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* contract */}
      <p className="text-center font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground">
        Contract{" "}
        <a href={`${ROBINHOOD_CHAIN.blockscout}/token/${data.address}`} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-signal">
          {data.address}
        </a>{" "}
        · Robinhood Chain
      </p>
    </div>
  );
}
