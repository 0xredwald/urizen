"use client";

import { useEffect, useRef, useState } from "react";
import { getQuote, resolveToken, fromRaw, type Quote } from "@/lib/rialto";
import { executeSwap } from "@/lib/swap-exec";
import { ROBINHOOD_CHAIN } from "@/lib/chain";

// A compact trade ticket the agent raises (proposeTrade) — the user reviews and signs. Non-custodial:
// the agent only proposes; executeSwap opens the user's wallet, handling token approval + Permit2 the
// same way the Alpha page buys (the raw send path reverts when USDG/token isn't yet approved). Spot on
// RH chain via Rialto best-route (USDG cash leg). Buy = spend USDG for the stock; Sell = stock for USDG.

export type ProposedTrade = { side: "buy" | "sell"; symbol: string; amount: number; note?: string };

export function TradeTicket({ trade, taker, onClose }: { trade: ProposedTrade; taker: string | null; onClose: () => void }) {
  const pay = trade.side === "buy" ? "USDG" : trade.symbol;
  const recv = trade.side === "buy" ? trade.symbol : "USDG";
  const amount = String(trade.amount);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [execStatus, setExecStatus] = useState("");
  const deb = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!taker || !parseFloat(amount)) return;
    setErr(null); setNotConfigured(false); setQuote(null);
    if (deb.current) clearTimeout(deb.current);
    deb.current = setTimeout(async () => {
      setLoading(true);
      try { setQuote(await getQuote({ sellSym: pay, buySym: recv, sellAmount: amount, taker, slippageBps: 200 })); }
      catch (e) { const er = e as Error & { notConfigured?: boolean }; setNotConfigured(!!er.notConfigured); setErr(er.message); }
      finally { setLoading(false); }
    }, 350);
    return () => { if (deb.current) clearTimeout(deb.current); };
  }, [pay, recv, amount, taker]);

  const dec = resolveToken(recv).decimals;
  const out = quote ? fromRaw(quote.buy_amount, dec) : 0;
  const minOut = quote ? fromRaw(quote.min_buy_amount, dec) : 0;

  const approve = async () => {
    if (!quote || !taker) return;
    setExecuting(true); setErr(null); setExecStatus("");
    try { setTxHash(await executeSwap(quote, taker, pay, setExecStatus)); }
    catch (e) { setErr((e as Error).message); }
    finally { setExecuting(false); setExecStatus(""); }
  };

  const up = trade.side === "buy";
  return (
    <div className="rounded-xl border border-signal/30 bg-signal/[0.05] p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.62rem] uppercase tracking-widest text-signal">⚑ Horizon proposes a trade</span>
        {!txHash && <button onClick={onClose} className="font-mono text-[0.7rem] text-muted-foreground hover:text-foreground">✕</button>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`font-display text-lg ${up ? "text-signal" : "text-[#ff5a5a]"}`}>{up ? "BUY" : "SELL"}</span>
        <span className="font-display text-lg text-foreground">{trade.symbol}</span>
        <span className="ml-auto font-mono text-sm tabular-nums text-foreground/85">{up ? `$${amount} USDG` : `${amount} ${trade.symbol}`}</span>
      </div>
      {trade.note && <p className="mt-1 text-[0.76rem] leading-snug text-muted-foreground">{trade.note}</p>}
      <div className="mt-2 grid gap-1 font-mono text-[0.72rem] text-muted-foreground">
        <div className="flex justify-between"><span>you receive (est)</span><span className="text-foreground/85 tabular-nums">{loading ? "…" : out ? `${out.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${recv}` : "—"}</span></div>
        {quote && <div className="flex justify-between"><span>min received · 2% slip</span><span className="tabular-nums">{minOut.toLocaleString(undefined, { maximumFractionDigits: 4 })} {recv}</span></div>}
      </div>
      {err && <div className="mt-2 rounded border border-[#ff5a5a]/40 bg-[#ff5a5a]/5 px-2 py-1.5 font-mono text-[0.68rem] text-[#ff5a5a]">{notConfigured ? "live swaps need RIALTO_API_KEY set on the server." : err}</div>}
      {txHash ? (
        <a href={`${ROBINHOOD_CHAIN.blockscout}/tx/${txHash}`} target="_blank" rel="noreferrer" className="mt-2 block rounded-lg border border-signal/60 bg-signal/10 px-3 py-2 text-center font-mono text-[0.68rem] uppercase tracking-widest text-signal hover:bg-signal/20">✓ sent · view on explorer ↗</a>
      ) : (
        <button onClick={approve} disabled={!quote || !taker || executing || loading}
          className="mt-2 w-full rounded-lg border border-signal/60 bg-signal/10 px-3 py-2 font-mono text-[0.68rem] uppercase tracking-widest text-signal transition-colors hover:bg-signal/20 disabled:border-border disabled:bg-transparent disabled:text-muted-foreground/50">
          {!taker ? "connect wallet to sign" : executing ? (execStatus || "confirm in wallet…") : loading ? "routing…" : quote ? "review + sign" : "…"}
        </button>
      )}
    </div>
  );
}
