"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useBalance, useReadContracts } from "wagmi";
import { erc20Abi } from "viem";
import { StockLogo } from "@/components/brand/stock-logo";
import { STOCKS } from "@/lib/stocks";
import { USDG, WETH, USDG_DECIMALS } from "@/lib/rialto";
import { URIZEN_TOKEN } from "@/lib/chain";
import { fetchUsd } from "@/lib/prices";
import { usd } from "@/lib/format";

const RH = 4663;

// every ERC-20 the wallet might hold on Robinhood Chain, read in one balanceOf batch
const ERC20S: { symbol: string; name: string; address: `0x${string}`; decimals: number }[] = [
  { symbol: "USDG", name: "Global Dollar", address: USDG as `0x${string}`, decimals: USDG_DECIMALS },
  { symbol: "WETH", name: "Wrapped Ether", address: WETH as `0x${string}`, decimals: 18 },
  { symbol: "URI", name: "Urizen", address: URIZEN_TOKEN as `0x${string}`, decimals: 18 },
  ...STOCKS.map((s) => ({ symbol: s.symbol, name: s.name, address: s.address, decimals: 18 })),
];

const amt = (x: number) => x.toLocaleString(undefined, { maximumFractionDigits: x >= 1 ? 4 : 6 });

type Row = { symbol: string; name: string; balance: number };

export function WalletBalances() {
  const { address, isConnected } = useAccount();
  const [prices, setPrices] = useState<Record<string, number>>({});

  const eth = useBalance({ address, chainId: RH, query: { enabled: !!address, refetchInterval: 30_000 } });
  const { data: raw, isLoading } = useReadContracts({
    allowFailure: true,
    contracts: ERC20S.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? [address] : undefined,
      chainId: RH,
    })),
    query: { enabled: !!address, refetchInterval: 30_000 },
  });

  // held tokens only, largest first — a wallet that holds 3 of 22 tokens shows 3 clean rows
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const ethBal = eth.data ? Number(eth.data.value) / 10 ** eth.data.decimals : 0;
    if (ethBal > 0) out.push({ symbol: "ETH", name: "Ether", balance: ethBal });
    ERC20S.forEach((t, i) => {
      const v = raw?.[i]?.result;
      const bal = typeof v === "bigint" ? Number(v) / 10 ** t.decimals : 0;
      if (bal > 0) out.push({ symbol: t.symbol, name: t.name, balance: bal });
    });
    return out;
  }, [eth.data, raw]);

  // price only the tokens actually held (avoids fetching 22 quotes for an empty wallet)
  const heldKey = rows.map((r) => r.symbol).join(",");
  useEffect(() => {
    if (!rows.length) return;
    let alive = true;
    Promise.all(rows.map(async (r) => [r.symbol, await fetchUsd(r.symbol)] as const)).then((entries) => {
      if (alive) setPrices((p) => ({ ...p, ...Object.fromEntries(entries) }));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldKey]);

  const valued = rows
    .map((r) => ({ ...r, usd: (prices[r.symbol] ?? 0) * r.balance }))
    .sort((a, b) => b.usd - a.usd);
  const total = valued.reduce((s, r) => s + r.usd, 0);
  const loading = !!address && (isLoading || eth.isLoading);

  return (
    <div className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-[#141416] p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[17px] font-semibold tracking-tight">Holdings</span>
        {total > 0 && <span className="tabular-nums text-[16px] font-semibold text-signal">{usd(total, 2)}</span>}
      </div>

      {!isConnected ? (
        <div className="rounded-2xl bg-[#0d0d0f] px-4 py-6 text-center text-[13px] text-muted-foreground">
          Connect your wallet to see your balances.
        </div>
      ) : loading ? (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl px-2 py-2.5">
              <div className="skeleton h-[34px] w-[34px] rounded-full" />
              <div className="flex-1"><div className="skeleton h-3 w-20 rounded" /><div className="skeleton mt-1.5 h-2.5 w-28 rounded" /></div>
              <div className="skeleton h-4 w-14 rounded" />
            </div>
          ))}
        </div>
      ) : valued.length === 0 ? (
        <div className="rounded-2xl bg-[#0d0d0f] px-4 py-6 text-center text-[13px] text-muted-foreground">
          No tokens yet on Robinhood Chain. Fund your wallet, then swap.
        </div>
      ) : (
        <div className="grid gap-0.5">
          {valued.map((r) => (
            <div key={r.symbol} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-white/[0.04]">
              <StockLogo symbol={r.symbol} size={34} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold tracking-tight">{r.symbol}</div>
                <div className="truncate text-[12px] text-muted-foreground">{r.name}</div>
              </div>
              <div className="text-right">
                <div className="tabular-nums text-[15px] font-semibold leading-tight">{amt(r.balance)}</div>
                <div className="tabular-nums text-[12px] text-muted-foreground">{r.usd > 0 ? usd(r.usd, 2) : "—"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
