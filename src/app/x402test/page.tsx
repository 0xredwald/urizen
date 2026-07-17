"use client";

import { useState } from "react";
import { useAccount, useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { wrapFetchWithPayment } from "x402-fetch";
import { publicActions } from "viem";
import { base } from "viem/chains";

// A no-private-key x402 tester: connect a browser wallet (on Base, with a little USDC), pay for one
// analysis, see the result. The wallet signs the gasless USDC payment — the key never leaves it.
const PRICES: Record<string, string> = { snapshot: "$0.01", standard: "$0.10", deep: "$0.50" };

export default function X402Test() {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [ticker, setTicker] = useState("NVDA");
  const [depth, setDepth] = useState("snapshot");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    if (!walletClient) { setStatus("Connect a wallet first."); return; }
    setBusy(true); setResult(""); setStatus("Preparing…");
    try {
      if (chainId !== base.id) { setStatus("Switch to Base in your wallet…"); await switchChainAsync({ chainId: base.id }); }
      setStatus("Confirm the USDC payment signature in your wallet…");
      // x402-fetch needs wallet + public actions; the connected wallet's transport provides both.
      const signer = walletClient.extend(publicActions);
      // maxValue 1 USDC so deep ($0.50) is allowed; the wallet signs a gasless EIP-3009 authorization.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pf = wrapFetchWithPayment(fetch, signer as any, BigInt(1_000_000));
      const res = await pf(`/api/x402/analyze?ticker=${encodeURIComponent(ticker)}&depth=${depth}`);
      const body = await res.json();
      setResult(JSON.stringify(body, null, 2));
      setStatus(res.status === 200 ? "✅ Paid + analysis returned." : `⚠️ HTTP ${res.status} — payment not completed (see below).`);
    } catch (e) {
      setStatus("Error: " + ((e as Error)?.message || String(e)).split("\n")[0]);
    } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-5 py-16">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-foreground">x402 · payment test</h1>
        <ConnectButton chainStatus="icon" showBalance={false} />
      </div>
      <p className="text-sm text-muted-foreground">
        Connect a wallet holding a little <b>USDC on Base</b> and pay for one Urizen analysis. The payment is a
        gasless signature — your key never leaves your wallet. Use a wallet that is <b>not</b> the receiving wallet.
      </p>

      <div className="flex flex-wrap items-end gap-3 rounded-[4px] border border-white/10 bg-white/[0.02] p-5">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Ticker
          <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            className="w-28 rounded-md border border-white/12 bg-[#0d0d0f] px-3 py-2 font-mono text-foreground outline-none focus:border-signal/50" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Depth
          <select value={depth} onChange={(e) => setDepth(e.target.value)}
            className="rounded-md border border-white/12 bg-[#0d0d0f] px-3 py-2 font-mono text-foreground outline-none focus:border-signal/50">
            {Object.entries(PRICES).map(([k, v]) => <option key={k} value={k}>{k} — {v}</option>)}
          </select>
        </label>
        <button onClick={pay} disabled={!isConnected || busy}
          className="ml-auto rounded-md border border-signal/50 bg-signal/10 px-5 py-2.5 font-mono text-sm uppercase tracking-widest text-signal transition-colors hover:bg-signal/20 disabled:opacity-40">
          {busy ? "Working…" : `Pay ${PRICES[depth]} + analyze`}
        </button>
      </div>

      {status && <div className="font-mono text-sm text-foreground/80">{status}</div>}
      {result && (
        <pre className="max-h-[50vh] overflow-auto rounded-[4px] border border-white/10 bg-[#0a0a0b] p-4 text-[12px] leading-relaxed text-foreground/90">{result}</pre>
      )}
    </main>
  );
}
