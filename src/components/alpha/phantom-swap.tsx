"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useBalance, useChainId, useReadContract, useSwitchChain } from "wagmi";
import { erc20Abi } from "viem";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { StockLogo } from "@/components/brand/stock-logo";
import { STOCKS } from "@/lib/stocks";
import { getQuote, resolveToken, fromRaw, type Quote } from "@/lib/rialto";
import { executeSwap } from "@/lib/swap-exec";
import { fetchUsd } from "@/lib/prices";

const TOKENS = ["USDG", "ETH", "WETH", ...STOCKS.map((s) => s.symbol)];
const RH = 4663;
const num = (x: number, dp = 6) => x.toLocaleString(undefined, { maximumFractionDigits: dp });
const usd = (x: number) => `$${x.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

function TokenButton({ sym, onClick }: { sym: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex shrink-0 items-center gap-2 rounded-full bg-white/[0.06] py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-white/[0.1]">
      <StockLogo symbol={sym} size={26} />
      <span className="text-[15px] font-semibold tracking-tight">{sym}</span>
      <span className="text-[10px] text-muted-foreground">▼</span>
    </button>
  );
}

function TokenPicker({ exclude, onPick, onClose }: { exclude?: string; onPick: (s: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const list = TOKENS.filter((t) => t !== exclude && t.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="absolute inset-0 z-20 flex flex-col rounded-2xl border border-white/10 bg-[#141416]">
      <div className="flex items-center gap-2 border-b border-white/10 p-3">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search token" className="min-w-0 flex-1 rounded-lg bg-white/[0.05] px-3 py-2 text-[14px] outline-none placeholder:text-muted-foreground/60" />
        <button onClick={onClose} className="px-1 text-muted-foreground hover:text-foreground">✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {list.map((t) => {
          const stock = STOCKS.find((s) => s.symbol === t);
          const sub = t === "USDG" ? "Global Dollar" : t === "ETH" ? "Ether" : t === "WETH" ? "Wrapped Ether" : stock?.name;
          return (
            <button key={t} onClick={() => { onPick(t); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.05]">
              <StockLogo symbol={t} size={30} />
              <div><div className="text-[15px] font-semibold tracking-tight">{t}</div><div className="text-[12px] text-muted-foreground">{sub}</div></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PhantomSwap({ defaultBuy = "NVDA", className = "" }: { defaultBuy?: string; className?: string }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();

  const [pay, setPay] = useState("USDG");
  const [recv, setRecv] = useState(defaultBuy);
  const [amount, setAmount] = useState("100");
  const [picker, setPicker] = useState<null | "pay" | "recv">(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [execStatus, setExecStatus] = useState<string | null>(null);
  const [payUsd, setPayUsd] = useState(0);
  const [recvUsd, setRecvUsd] = useState(0);
  const deb = useRef<ReturnType<typeof setTimeout> | null>(null);

  const payTok = resolveToken(pay);
  const recvTok = resolveToken(recv);

  // balance — native ETH via useBalance, ERC-20 otherwise
  const nativeBal = useBalance({ address, chainId: RH, query: { enabled: !!address && payTok.native } });
  const { data: erc20Bal } = useReadContract({
    address: payTok.address as `0x${string}`, abi: erc20Abi, functionName: "balanceOf",
    args: address ? [address] : undefined, chainId: RH, query: { enabled: !!address && !payTok.native },
  });
  const balance = payTok.native
    ? (nativeBal.data ? Number(nativeBal.data.value) / 10 ** nativeBal.data.decimals : null)
    : (erc20Bal != null ? Number(erc20Bal) / 10 ** payTok.decimals : null);

  // USD prices for both legs
  useEffect(() => { fetchUsd(pay).then(setPayUsd); }, [pay]);
  useEffect(() => { fetchUsd(recv).then(setRecvUsd); }, [recv]);

  useEffect(() => {
    setQuote(null); setErr(null); setNotConfigured(false); setTxHash(null);
    const amt = parseFloat(amount);
    if (!address || !amt || amt <= 0 || pay === recv) return;
    if (deb.current) clearTimeout(deb.current);
    deb.current = setTimeout(async () => {
      setLoading(true);
      try { setQuote(await getQuote({ sellSym: pay, buySym: recv, sellAmount: amount, taker: address, slippageBps: 100 })); }
      catch (e) { const er = e as Error & { notConfigured?: boolean }; setNotConfigured(!!er.notConfigured); setErr(er.message); }
      finally { setLoading(false); }
    }, 450);
    return () => { if (deb.current) clearTimeout(deb.current); };
  }, [pay, recv, amount, address]);

  const flip = () => { setPay(recv); setRecv(pay); setQuote(null); };
  const out = quote ? fromRaw(quote.buy_amount, recvTok.decimals) : 0;
  const minOut = quote ? fromRaw(quote.min_buy_amount, recvTok.decimals) : 0;
  const rate = quote && parseFloat(amount) ? out / parseFloat(amount) : 0;
  const payAmt = parseFloat(amount) || 0;

  const doSwap = async () => {
    if (!quote || !address) return;
    setExecuting(true); setErr(null);
    try {
      if (chainId !== RH) await switchChainAsync({ chainId: RH });
      const hash = await executeSwap(quote, address, pay, setExecStatus);
      setTxHash(hash);
    } catch (e) { setErr((e as Error).message.split("\n")[0]); } finally { setExecuting(false); setExecStatus(null); }
  };

  const wrongChain = isConnected && chainId !== RH;
  const label = !isConnected ? "Connect wallet" : wrongChain ? "Switch to Robinhood Chain"
    : loading ? "Fetching best price…" : executing ? (execStatus ?? "Confirm in your wallet…")
    : !quote ? "Enter an amount" : `Swap ${pay} for ${recv}`;
  const canSwap = isConnected && !wrongChain && !!quote && !executing && !loading;
  const primary = async () => {
    if (!isConnected) { openConnectModal?.(); return; }
    if (wrongChain) { await switchChainAsync({ chainId: RH }).catch(() => {}); return; }
    doSwap();
  };

  return (
    <div className={`relative w-full max-w-[420px] rounded-3xl border border-white/10 bg-[#141416] p-4 shadow-2xl ${className}`}>
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[17px] font-semibold tracking-tight">Swap</span>
        <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">1% slippage</span>
      </div>

      {/* you pay */}
      <div className="rounded-2xl bg-[#0d0d0f] p-4">
        <div className="mb-2 flex items-center justify-between text-[13px] text-muted-foreground">
          <span>You pay</span>
          {balance != null && (
            <button onClick={() => setAmount(String(Math.floor(balance * 1e6) / 1e6))} className="tabular-nums transition-colors hover:text-signal">
              {num(balance, 4)} {pay} · <span className="font-semibold text-signal">Max</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0"
              className="w-full bg-transparent text-[34px] font-semibold leading-none tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/40" />
            <div className="mt-1.5 text-[13px] tabular-nums text-muted-foreground">{payUsd ? usd(payAmt * payUsd) : "—"}</div>
          </div>
          <TokenButton sym={pay} onClick={() => setPicker("pay")} />
        </div>
      </div>

      {/* flip */}
      <div className="relative z-10 flex justify-center" style={{ marginTop: -14, marginBottom: -14 }}>
        <button onClick={flip} className="grid h-10 w-10 place-items-center rounded-2xl border-4 border-[#141416] bg-[#0d0d0f] text-signal transition-transform hover:rotate-180" aria-label="flip">⇅</button>
      </div>

      {/* you receive */}
      <div className="rounded-2xl bg-[#0d0d0f] p-4">
        <div className="mb-2 text-[13px] text-muted-foreground">You receive</div>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[34px] font-semibold leading-none tracking-tight tabular-nums text-foreground/90">{loading ? "…" : out ? num(out) : "0"}</div>
            <div className="mt-1.5 text-[13px] tabular-nums text-muted-foreground">{out && recvUsd ? usd(out * recvUsd) : "—"}</div>
          </div>
          <TokenButton sym={recv} onClick={() => setPicker("recv")} />
        </div>
      </div>

      {/* details */}
      {quote && (
        <div className="mt-3 grid gap-1.5 px-1 text-[13px] text-muted-foreground">
          <div className="flex justify-between"><span>Rate</span><span className="tabular-nums text-foreground/80">1 {pay} ≈ {num(rate)} {recv}</span></div>
          <div className="flex justify-between"><span>Minimum received</span><span className="tabular-nums text-foreground/80">{num(minOut)} {recv}</span></div>
          {typeof quote.network_fee === "number" && <div className="flex justify-between"><span>Network fee</span><span className="tabular-nums text-foreground/80">~${quote.network_fee.toFixed(3)}</span></div>}
        </div>
      )}

      {err && !txHash && <div className="mt-3 rounded-2xl border border-[#ff5c5c]/30 bg-[#ff5c5c]/[0.06] px-3 py-2.5 text-[13px] text-[#ff5c5c]">{notConfigured ? "Live trading isn't switched on yet — the routing key isn't set." : err}</div>}

      {txHash ? (
        <a href={`https://robinhoodchain.blockscout.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="mt-3 block rounded-2xl bg-signal py-4 text-center text-[16px] font-semibold text-[#04140a] transition-opacity hover:opacity-90">✓ Swap sent · view ↗</a>
      ) : (
        <button onClick={primary} disabled={isConnected && !wrongChain && !canSwap} className="mt-3 w-full rounded-2xl bg-signal py-4 text-[16px] font-semibold tracking-tight text-[#04140a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{label}</button>
      )}

      {picker && <TokenPicker exclude={picker === "pay" ? recv : pay} onClose={() => setPicker(null)} onPick={(t) => (picker === "pay" ? setPay(t) : setRecv(t))} />}
    </div>
  );
}
