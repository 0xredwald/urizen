"use client";

import { useEffect, useRef, useState } from "react";
import { StockLogo } from "@/components/brand/stock-logo";
import { STOCKS } from "@/lib/stocks";
import { ROBINHOOD_CHAIN } from "@/lib/chain";
import { getQuote, executeQuote, resolveToken, fromRaw, type Quote, type SwapProposal } from "@/lib/rialto";

const TOKENS = ["USDG", ...STOCKS.map((s) => s.symbol), "WETH"];

function TokenSelect({ value, onChange, exclude }: { value: string; onChange: (s: string) => void; exclude?: string }) {
  return (
    <div className="flex items-center gap-2 border border-input bg-background px-2 py-1.5">
      <StockLogo symbol={value === "USDG" ? "USDG" : value} size={22} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-mono text-sm font-medium text-foreground focus:outline-none"
      >
        {TOKENS.filter((t) => t !== exclude).map((t) => (
          <option key={t} value={t} className="bg-background">{t}</option>
        ))}
      </select>
    </div>
  );
}

export function SwapPanel({
  taker, proposal, onClearProposal, defaultBuy = "NVDA",
}: {
  taker: string | null;
  proposal?: SwapProposal | null;
  onClearProposal?: () => void;
  defaultBuy?: string;
}) {
  const [pay, setPay] = useState("USDG");
  const [recv, setRecv] = useState(defaultBuy);
  const [amount, setAmount] = useState("100");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // apply an agent proposal
  useEffect(() => {
    if (!proposal) return;
    setPay(proposal.sellSym.toUpperCase());
    setRecv(proposal.buySym.toUpperCase());
    setAmount(proposal.sellAmount);
    setTxHash(null);
  }, [proposal]);

  // debounced quote
  useEffect(() => {
    setQuote(null); setErr(null); setNotConfigured(false); setTxHash(null);
    const amt = parseFloat(amount);
    if (!taker || !amt || amt <= 0 || pay === recv) return;
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const q = await getQuote({ sellSym: pay, buySym: recv, sellAmount: amount, taker, slippageBps: 100 });
        setQuote(q);
      } catch (e) {
        const er = e as Error & { notConfigured?: boolean };
        setNotConfigured(!!er.notConfigured);
        setErr(er.message);
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [pay, recv, amount, taker]);

  const flip = () => { setPay(recv); setRecv(pay); setQuote(null); };

  const doSwap = async () => {
    if (!quote || !taker) return;
    setExecuting(true); setErr(null);
    try {
      const hash = await executeQuote(quote, taker);
      setTxHash(hash);
      onClearProposal?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setExecuting(false);
    }
  };

  const recvDec = resolveToken(recv).decimals;
  const buyOut = quote ? fromRaw(quote.buy_amount, recvDec) : 0;
  const minOut = quote ? fromRaw(quote.min_buy_amount, recvDec) : 0;
  const rate = quote && parseFloat(amount) ? buyOut / parseFloat(amount) : 0;

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Trade · onchain</span>
        <span className="font-mono text-[10px] text-muted-foreground">best route · you sign</span>
      </div>

      {proposal && (
        <div className="flex items-start gap-2 border-b border-signal/25 bg-signal/[0.06] px-4 py-2.5">
          <span className="mt-0.5 text-signal">◈</span>
          <div className="flex-1">
            <div className="font-mono text-[10px] uppercase tracking-widest text-signal">Agent proposed this swap</div>
            {proposal.rationale && <p className="mt-0.5 text-[12px] leading-snug text-foreground/85">{proposal.rationale}</p>}
          </div>
          <button onClick={onClearProposal} className="font-mono text-[11px] text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      <div className="grid gap-2 p-4">
        {/* pay */}
        <div className="grid gap-1.5 border border-border bg-background p-3">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">You pay</span>
          <div className="flex items-center gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="min-w-0 flex-1 bg-transparent font-mono text-2xl tabular-nums text-foreground focus:outline-none"
              placeholder="0.0"
            />
            <TokenSelect value={pay} onChange={setPay} exclude={recv} />
          </div>
        </div>

        {/* flip */}
        <button onClick={flip} className="mx-auto -my-3.5 grid h-7 w-7 place-items-center border border-border bg-card text-signal transition-colors hover:border-signal/60" aria-label="flip">
          ⇅
        </button>

        {/* receive */}
        <div className="grid gap-1.5 border border-border bg-background p-3">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">You receive · estimated</span>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-2xl tabular-nums text-foreground/90">
              {loading ? "…" : buyOut ? buyOut.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0.0"}
            </span>
            <TokenSelect value={recv} onChange={setRecv} exclude={pay} />
          </div>
        </div>

        {/* quote details */}
        {quote && (
          <div className="grid gap-1 border border-border bg-background px-3 py-2 font-mono text-[11px] text-muted-foreground">
            <Row k="Rate" v={`1 ${pay} ≈ ${rate.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${recv}`} />
            <Row k="Min received" v={`${minOut.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${recv}`} />
            <Row k="Route" v={`${quote.route?.legs?.length ?? 1} hop${(quote.route?.legs?.length ?? 1) > 1 ? "s" : ""} · slippage 1%`} />
            {typeof quote.network_fee === "number" && <Row k="Network fee" v={`~$${quote.network_fee.toFixed(3)}`} />}
          </div>
        )}

        {err && (
          <div className="border border-[#ff5c5c]/40 bg-[#ff5c5c]/5 px-3 py-2 font-mono text-[11px] text-[#ff5c5c]">
            {notConfigured ? "Trading key not set yet — add RIALTO_API_KEY on the server to enable live swaps." : err}
          </div>
        )}

        {txHash ? (
          <a href={`${ROBINHOOD_CHAIN.blockscout}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
            className="border border-signal/60 bg-signal/10 px-4 py-3 text-center font-mono text-xs uppercase tracking-[0.2em] text-signal hover:bg-signal/20">
            ✓ swap sent · view on explorer ↗
          </a>
        ) : (
          <button
            onClick={doSwap}
            disabled={!quote || !taker || executing || loading}
            className="border border-signal/60 bg-signal/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-signal transition-colors hover:bg-signal/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-background disabled:text-muted-foreground/50"
          >
            {!taker ? "connect wallet to trade" : executing ? "confirm in wallet…" : loading ? "routing…" : quote ? `swap ${pay} → ${recv}` : "enter an amount"}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground/90">{v}</span>
    </div>
  );
}
