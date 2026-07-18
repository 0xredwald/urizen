"use client";

import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { erc20Abi } from "viem";
import { StockLogo } from "@/components/brand/stock-logo";
import { STOCKS } from "@/lib/stocks";
import { resolveToken } from "@/lib/rialto";

// The user's on-chain holdings on Robinhood Chain — reads ERC-20 balanceOf for USDG + every
// tokenized equity in one multicall, values them with the live quote map, and lists non-zero
// positions with a running total. Non-custodial, read-only. Replaces the (redundant) watchlist.
const RH = 4663;
const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center px-4 text-center font-mono text-[0.66rem] uppercase tracking-widest text-muted-foreground/50">{children}</div>;
}

export function Portfolio({ prices, onPick }: { prices: Record<string, number>; onPick: (s: string) => void }) {
  const { address, isConnected } = useAccount();
  const tokens = useMemo(() => ["USDG", ...STOCKS.map((s) => s.symbol)], []);
  const contracts = useMemo(() => tokens.map((sym) => ({
    address: resolveToken(sym).address as `0x${string}`,
    abi: erc20Abi, functionName: "balanceOf" as const,
    args: [address ?? "0x0000000000000000000000000000000000000000"] as const, chainId: RH,
  })), [tokens, address]);
  const { data, isLoading } = useReadContracts({ contracts, query: { enabled: !!address, refetchInterval: 30000 } });

  const holdings = useMemo(() => {
    if (!data) return [];
    return tokens.map((sym, i) => {
      const t = resolveToken(sym);
      const raw = data[i]?.result as bigint | undefined;
      const bal = raw ? Number(raw) / 10 ** t.decimals : 0;
      const price = sym === "USDG" ? 1 : (prices[sym] ?? 0);
      return { sym, bal, usd: bal * price };
    }).filter((h) => h.bal > 1e-6).sort((a, b) => b.usd - a.usd);
  }, [data, tokens, prices]);
  const total = holdings.reduce((s, h) => s + h.usd, 0);

  if (!isConnected) return <Empty>connect wallet to see holdings</Empty>;
  if (isLoading && !holdings.length) return <Empty>reading balances…</Empty>;
  if (!holdings.length) return <Empty>no holdings yet</Empty>;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between border-b border-border/60 px-3 py-2">
        <span className="font-mono text-[0.54rem] uppercase tracking-widest text-muted-foreground">Total value</span>
        <span className="font-display text-base tabular-nums text-signal">${fmt(total)}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-[0.76rem]">
          <tbody>
            {holdings.map((h) => (
              <tr key={h.sym} onClick={() => h.sym !== "USDG" && onPick(h.sym)}
                className={`border-b border-border/40 ${h.sym !== "USDG" ? "cursor-pointer hover:bg-white/[0.03]" : ""}`}>
                <td className="py-1.5 pl-3 pr-2"><div className="flex items-center gap-2"><StockLogo symbol={h.sym} size={16} /><span className="font-mono">{h.sym}</span></div></td>
                <td className="py-1.5 pr-2 text-right font-mono tabular-nums text-foreground/80">{fmt(h.bal, h.bal < 1 ? 4 : 2)}</td>
                <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-muted-foreground">{h.usd > 0 ? `$${fmt(h.usd)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
