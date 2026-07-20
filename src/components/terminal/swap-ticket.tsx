"use client";

// The always-on order ticket. Unlike the big marketing swap card, this is a dense, terminal-native
// panel meant to sit permanently in the rail — like a trading desk's order form that's never more
// than a glance away. It follows the chart: pick a symbol on the left and the ticket arms to buy it.
// Shares the exact quote/execute path as the rest of the app (Rialto best-route + Permit2).

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

function Tok({ sym, onClick }: { sym: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-white/[0.04] py-1 pl-1 pr-2 transition-colors hover:bg-white/[0.08]">
      <StockLogo symbol={sym} size={18} />
      <span className="font-mono text-[0.82rem] font-medium tracking-tight">{sym}</span>
      <span className="text-[8px] text-muted-foreground">▼</span>
    </button>
  );
}

function Picker({ exclude, onPick, onClose }: { exclude?: string; onPick: (s: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const list = TOKENS.filter((t) => t !== exclude && t.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="absolute inset-0 z-30 flex flex-col border border-border bg-[#0b0b0d]">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search token" className="min-w-0 flex-1 rounded bg-white/[0.05] px-2.5 py-1.5 font-mono text-[0.78rem] outline-none placeholder:text-muted-foreground/50" />
        <button onClick={onClose} className="px-1 font-mono text-sm text-muted-foreground hover:text-foreground">✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {list.map((t) => {
          const stock = STOCKS.find((s) => s.symbol === t);
          const sub = t === "USDG" ? "Global Dollar" : t === "ETH" ? "Ether" : t === "WETH" ? "Wrapped Ether" : stock?.name;
          return (
            <button key={t} onClick={() => { onPick(t); onClose(); }} className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05]">
              <StockLogo symbol={t} size={22} />
              <div className="min-w-0"><div className="font-mono text-[0.82rem] font-medium">{t}</div><div className="truncate text-[0.64rem] text-muted-foreground">{sub}</div></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SwapTicket({ defaultBuy = "NVDA", defaultSell = "USDG", defaultAmount = "100" }: { defaultBuy?: string; defaultSell?: string; defaultAmount?: string }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();

  const [pay, setPay] = useState(defaultSell);
  const [recv, setRecv] = useState(defaultBuy);
  const [amount, setAmount] = useState(defaultAmount);
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

  // the ticket arms to whatever's on the chart — pick a symbol on the left, the buy leg follows.
  // (touch the receive picker and it stops chasing, so a user-chosen pair isn't yanked away)
  const userSetRecv = useRef(false);
  useEffect(() => {
    if (userSetRecv.current) return;
    if (defaultBuy && defaultBuy !== recv && defaultBuy !== pay) setRecv(defaultBuy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBuy]);

  const payTok = resolveToken(pay);
  const recvTok = resolveToken(recv);

  const nativeBal = useBalance({ address, chainId: RH, query: { enabled: !!address && payTok.native } });
  const { data: erc20Bal } = useReadContract({
    address: payTok.address as `0x${string}`, abi: erc20Abi, functionName: "balanceOf",
    args: address ? [address] : undefined, chainId: RH, query: { enabled: !!address && !payTok.native },
  });
  const balance = payTok.native
    ? (nativeBal.data ? Number(nativeBal.data.value) / 10 ** nativeBal.data.decimals : null)
    : (erc20Bal != null ? Number(erc20Bal) / 10 ** payTok.decimals : null);

  useEffect(() => { fetchUsd(pay).then(setPayUsd); }, [pay]);
  useEffect(() => { fetchUsd(recv).then(setRecvUsd); }, [recv]);

  useEffect(() => {
    setQuote(null); setErr(null); setNotConfigured(false); setTxHash(null);
    const amt = parseFloat(amount);
    if (!address || !amt || amt <= 0 || pay === recv) return;
    if (deb.current) clearTimeout(deb.current);
    deb.current = setTimeout(async () => {
      setLoading(true);
      try { setQuote(await getQuote({ sellSym: pay, buySym: recv, sellAmount: amount, taker: address, slippageBps: 200 })); }
      catch (e) { const er = e as Error & { notConfigured?: boolean }; setNotConfigured(!!er.notConfigured); setErr(er.message); }
      finally { setLoading(false); }
    }, 450);
    return () => { if (deb.current) clearTimeout(deb.current); };
  }, [pay, recv, amount, address]);

  const flip = () => { setPay(recv); setRecv(pay); setQuote(null); userSetRecv.current = true; };
  const pickRecv = (t: string) => { setRecv(t); userSetRecv.current = true; };
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
    : !quote ? "Enter an amount" : `Buy ${recv}`;
  const canSwap = isConnected && !wrongChain && !!quote && !executing && !loading;
  const primary = async () => {
    if (!isConnected) { openConnectModal?.(); return; }
    if (wrongChain) { await switchChainAsync({ chainId: RH }).catch(() => {}); return; }
    doSwap();
  };

  return (
    <div className="relative flex h-full flex-col p-2.5">
      {/* pay */}
      <div className="rounded-md border border-border bg-[#0d0d0f] px-3 py-2">
        <div className="mb-1 flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground">
          <span>Pay</span>
          {balance != null && (
            <button onClick={() => setAmount(String(Math.floor(balance * 1e6) / 1e6))} className="tabular-nums transition-colors hover:text-signal">
              {num(balance, 4)} · <span className="text-signal">MAX</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0"
            className="min-w-0 flex-1 bg-transparent font-display text-[1.6rem] leading-none tabular-nums outline-none placeholder:text-muted-foreground/40" />
          <Tok sym={pay} onClick={() => setPicker("pay")} />
        </div>
        <div className="mt-1 font-mono text-[0.62rem] tabular-nums text-muted-foreground/70">{payUsd ? usd(payAmt * payUsd) : "—"}</div>
      </div>

      {/* flip */}
      <div className="relative z-10 flex justify-center" style={{ marginTop: -9, marginBottom: -9 }}>
        <button onClick={flip} className="grid h-7 w-7 place-items-center rounded-md border-2 border-[#0b0b0d] bg-[#0d0d0f] font-mono text-signal transition-transform hover:rotate-180" aria-label="flip">⇅</button>
      </div>

      {/* receive */}
      <div className="rounded-md border border-border bg-[#0d0d0f] px-3 py-2">
        <div className="mb-1 font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground">Receive</div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate font-display text-[1.6rem] leading-none tabular-nums text-foreground/90">{loading ? "…" : out ? num(out) : "0"}</div>
          <Tok sym={recv} onClick={() => setPicker("recv")} />
        </div>
        <div className="mt-1 font-mono text-[0.62rem] tabular-nums text-muted-foreground/70">{out && recvUsd ? usd(out * recvUsd) : "—"}</div>
      </div>

      {/* details */}
      {quote && (
        <div className="mt-2 grid gap-1 px-0.5 font-mono text-[0.62rem] text-muted-foreground">
          <div className="flex justify-between"><span>Rate</span><span className="tabular-nums text-foreground/75">1 {pay} ≈ {num(rate)} {recv}</span></div>
          <div className="flex justify-between"><span>Min received</span><span className="tabular-nums text-foreground/75">{num(minOut)} {recv}</span></div>
          {typeof quote.network_fee === "number" && <div className="flex justify-between"><span>Network fee</span><span className="tabular-nums text-foreground/75">~${quote.network_fee.toFixed(3)}</span></div>}
        </div>
      )}

      {err && !txHash && <div className="mt-2 rounded-md border border-[#ff5c5c]/30 bg-[#ff5c5c]/[0.06] px-2.5 py-1.5 font-mono text-[0.62rem] text-[#ff5c5c]">{notConfigured ? "Live trading isn't switched on yet — the routing key isn't set." : err}</div>}

      <div className="mt-auto pt-2.5">
        {txHash ? (
          <a href={`https://robinhoodchain.blockscout.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="block rounded-md bg-signal py-2.5 text-center font-mono text-[0.78rem] font-semibold uppercase tracking-wide text-[#04140a] transition-opacity hover:opacity-90">✓ Sent · view ↗</a>
        ) : (
          <button onClick={primary} disabled={isConnected && !wrongChain && !canSwap} className="w-full rounded-md bg-signal py-2.5 font-mono text-[0.78rem] font-semibold uppercase tracking-wide text-[#04140a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{label}</button>
        )}
      </div>

      {picker && <Picker exclude={picker === "pay" ? recv : pay} onClose={() => setPicker(null)} onPick={(t) => (picker === "pay" ? setPay(t) : pickRecv(t))} />}
    </div>
  );
}
