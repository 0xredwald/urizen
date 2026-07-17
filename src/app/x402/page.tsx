"use client";

import { useEffect, useRef, useState } from "react";
import { useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { createPaymentHeader, selectPaymentRequirements } from "x402/client";
import { PaymentRequirementsSchema, ChainIdToNetwork } from "x402/types";
import { publicActions } from "viem";
import { base } from "viem/chains";
import { UrizenMark } from "@/components/brand/marks";

// The Urizen x402 desk — prompt in a ticker (or the whole market), pay a few cents in USDC on Base,
// watch the analyst panel synthesize, read the verdict. Non-custodial: the wallet signs a gasless
// EIP-3009 authorization, the key never leaves it. x402 settles on Base (that's where the
// facilitator + USDC live), so the flow switches the wallet to Base before paying.
const PRICES = { snapshot: "$0.01", standard: "$0.10", deep: "$0.50" } as const;
type Depth = keyof typeof PRICES;

const AGENTS = [
  { key: "technical", label: "Technical", stock: "reading the tape", market: "breadth & the tape" },
  { key: "fundamental", label: "Fundamental", stock: "filings + the Street", market: "rates & macro regime" },
  { key: "macro", label: "Macro & catalyst", stock: "rates · calendar · odds", market: "calendar · odds" },
  { key: "flow", label: "News-flow", stock: "headlines + on-chain", market: "narrative & sentiment" },
] as const;

// Curated preset universe — the recognizable tokenized names, with real logos.
const PRESETS = [
  { s: "NVDA", n: "NVIDIA" }, { s: "AAPL", n: "Apple" }, { s: "TSLA", n: "Tesla" },
  { s: "MSFT", n: "Microsoft" }, { s: "AMZN", n: "Amazon" }, { s: "GOOGL", n: "Alphabet" },
  { s: "META", n: "Meta" }, { s: "AMD", n: "AMD" }, { s: "COIN", n: "Coinbase" },
  { s: "HOOD", n: "Robinhood" }, { s: "SPY", n: "S&P 500 ETF" }, { s: "QQQ", n: "Nasdaq 100 ETF" },
];
const logo = (s: string) => `https://financialmodelingprep.com/image-stock/${s}.png`;

type Report = {
  ticker: string; name: string; depth: string; thesis: string;
  agents?: Record<string, string>;
  data?: { technicals?: string };
};
type Phase = "idle" | "run" | "synth" | "done" | "error";
type Mode = "stock" | "market";

function Logo({ s, size = 22 }: { s: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) return <span className="grid place-items-center rounded-full bg-white/10 font-mono text-[9px] text-foreground/70" style={{ width: size, height: size }}>{s.slice(0, 2)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logo(s)} alt="" width={size} height={size} onError={() => setErr(true)} className="rounded-full bg-white object-contain" style={{ width: size, height: size }} />;
}

export default function X402Desk() {
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const [mode, setMode] = useState<Mode>("stock");
  const [ticker, setTicker] = useState("NVDA");
  const [depth, setDepth] = useState<Depth>("deep");
  const [phase, setPhase] = useState<Phase>("idle");
  const [active, setActive] = useState(-1);
  const [msg, setMsg] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [indices, setIndices] = useState<{ label: string; changePct: number }[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => clearTimers(), []);
  // live index strip — makes the desk feel alive, and grounds "whole market" mode
  useEffect(() => {
    fetch("/api/quant/market").then((r) => r.json()).then((d) => {
      const want = ["S&P 500", "Nasdaq", "VIX"];
      setIndices((d?.items || []).filter((m: { label: string }) => want.includes(m.label)));
    }).catch(() => {});
  }, []);

  const query = mode === "market" ? "MARKET" : ticker;
  const busy = phase === "run" || phase === "synth";

  const run = async () => {
    if (!walletClient || busy) return;
    setReport(null); setMsg(""); setPhase("run");
    const url = `/api/x402/analyze?ticker=${encodeURIComponent(query)}&depth=${depth}`;
    try {
      if (chainId !== base.id) { setMsg("Switch to Base in your wallet…"); await switchChainAsync({ chainId: base.id }); }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signer = walletClient.extend(publicActions) as any;

      // 1) ask the endpoint for the price — a cheap 402 challenge, no signature, no analysis yet
      setMsg("Preparing…");
      const first = await fetch(url);
      if (first.status !== 200 && first.status !== 402) {
        const b = await first.json().catch(() => ({})); setPhase("error"); setMsg(b?.error || `HTTP ${first.status}`); return;
      }
      if (first.status === 200) { setReport(await first.json()); setPhase("done"); return; } // payments off → served directly
      const { x402Version, accepts } = await first.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = accepts.map((a: any) => PaymentRequirementsSchema.parse(a));
      const selected = selectPaymentRequirements(parsed, ChainIdToNetwork[base.id], "exact");
      if (BigInt(selected.maxAmountRequired) > BigInt(1_000_000)) throw new Error("Payment exceeds the $1 cap");

      // 2) SIGN — this opens the wallet. Nothing animates until the user actually signs.
      setMsg("Confirm the payment in your wallet…");
      const paymentHeader = await createPaymentHeader(signer, x402Version, selected);

      // 3) signed → NOW start the pipeline animation while the server does the real work
      setPhase("synth"); setActive(0);
      const stepMs = depth === "deep" ? 2800 : depth === "standard" ? 1500 : 900;
      for (let i = 1; i <= AGENTS.length; i++) timers.current.push(setTimeout(() => setActive(i), i * stepMs));

      // 4) the paid request — carries the signed authorization; server verifies, settles, analyses
      const res = await fetch(url, { headers: { "X-PAYMENT": paymentHeader, "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE" } });
      const body = await res.json();
      clearTimers();
      if (res.status !== 200) {
        const d = body?._debug;
        const why = d ? `${d.stage}: ${d.invalidReason || d.errorReason || d.error || "rejected"}` : body?.error;
        setPhase("error"); setMsg(why || `Payment not completed (HTTP ${res.status}).`); return;
      }
      setReport(body); setPhase("done");
    } catch (e) {
      clearTimers(); setPhase("error");
      setMsg(((e as Error)?.message || String(e)).split("\n")[0].replace(/^Error:\s*/, ""));
    }
  };

  const reset = () => { clearTimers(); setPhase("idle"); setActive(-1); setReport(null); setMsg(""); };

  return (
    <main className="relative min-h-screen overflow-hidden text-foreground">
      {/* ── minimal, monochrome Blake behind an animated green dither ──
          fixed + z-0 (not -z-10) so main's own layer can't paint over it. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-[#060608]">
        {/* the Ancient of Days — desaturated to a whisper, no colour cast */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/blake-ancient.jpg" alt="" className="kenburns absolute inset-0 h-full w-full object-cover object-[center_16%]"
          style={{ filter: "grayscale(1) contrast(1.15) brightness(0.6)", opacity: 0.24 }} />
        {/* two interfering dot-grids drifting opposite ways = a soft diffusion shimmer */}
        <div className="dither dither-a" />
        <div className="dither dither-b" />
        {/* soft vignette to hold the centre + a whisper of green at the base */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(135% 95% at 50% 40%, transparent 0%, transparent 44%, rgba(6,6,8,0.72) 82%, #060608 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: "radial-gradient(55% 100% at 50% 125%, rgba(52,240,3,0.10), transparent 72%)" }} />
      </div>

      {/* ── top bar ── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <a href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[5px] bg-signal/15"><UrizenMark className="h-4 w-auto text-signal" /></span>
          <span className="font-display text-lg tracking-tight">Urizen</span>
          <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">x402</span>
        </a>
        <ConnectButton chainStatus="icon" showBalance={false} accountStatus="avatar" />
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] max-w-3xl flex-col items-center justify-center px-5 pb-16">
        {/* ── idle / run: the prompt ── */}
        {(phase === "idle" || phase === "run") && (
          <div className="w-full max-w-xl">
            {/* live index ticker */}
            {indices.length > 0 && (
              <div className="mb-6 flex items-center justify-center gap-5 font-mono text-[0.72rem] text-muted-foreground">
                {indices.map((m) => (
                  <span key={m.label} className="flex items-center gap-1.5">
                    <span className="uppercase tracking-wider">{m.label}</span>
                    <span className={m.changePct >= 0 ? "text-signal" : "text-[#ff7a7a]"}>{m.changePct >= 0 ? "+" : ""}{m.changePct.toFixed(2)}%</span>
                  </span>
                ))}
              </div>
            )}

            <h1 className="text-center font-display text-[clamp(2.4rem,7vw,4rem)] font-medium leading-[0.98] tracking-tight">
              The measure of<br />any <span className="text-signal">market.</span>
            </h1>

            {/* mode toggle */}
            <div className="mx-auto mt-8 flex w-fit rounded-full border border-white/12 bg-white/[0.03] p-1 backdrop-blur-xl">
              {(["stock", "market"] as Mode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`rounded-full px-5 py-1.5 font-mono text-[0.72rem] uppercase tracking-[0.14em] transition-colors ${mode === m ? "bg-signal/15 text-signal" : "text-muted-foreground hover:text-foreground"}`}>
                  {m === "stock" ? "Single stock" : "Whole market"}
                </button>
              ))}
            </div>

            {/* prompt card */}
            <div className="mx-auto mt-5 w-full rounded-2xl border border-white/12 bg-white/[0.04] p-2 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                {mode === "stock" ? (
                  <>
                    <span className="pl-3"><Logo s={ticker || "NVDA"} size={26} /></span>
                    <input
                      value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6))}
                      placeholder="TICKER" spellCheck={false}
                      className="min-w-0 flex-1 bg-transparent py-3 font-display text-2xl tracking-tight outline-none placeholder:text-muted-foreground/40"
                    />
                  </>
                ) : (
                  <div className="flex flex-1 items-center gap-3 pl-3 py-3">
                    <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-signal/15 text-signal">◎</span>
                    <span className="font-display text-2xl tracking-tight">US market sentiment</span>
                  </div>
                )}
                <select value={depth} onChange={(e) => setDepth(e.target.value as Depth)}
                  className="shrink-0 rounded-lg border border-white/10 bg-[#0d0d12] px-3 py-2.5 font-mono text-xs uppercase tracking-wider text-muted-foreground outline-none">
                  {Object.entries(PRICES).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
                </select>
              </div>
            </div>

            {/* preset stocks with logos */}
            {mode === "stock" && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {PRESETS.map((p) => (
                  <button key={p.s} onClick={() => setTicker(p.s)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.78rem] transition-colors ${ticker === p.s ? "border-signal/50 bg-signal/10 text-signal" : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/25 hover:text-foreground"}`}>
                    <Logo s={p.s} size={18} />
                    <span className="font-mono tracking-wide">{p.s}</span>
                  </button>
                ))}
              </div>
            )}

            {/* the one CTA — connects, switches to Base, pays; whatever the next step is */}
            <div className="mt-7 flex flex-col items-center gap-3">
              <ConnectButton.Custom>
                {({ account, chain, openConnectModal, mounted }) => {
                  const connected = mounted && !!account && !!chain;
                  const onBase = chain?.id === base.id;
                  const label = phase === "run" ? (msg || "Working…")
                    : !connected ? "Connect wallet"
                    : !onBase ? "Switch to Base to pay"
                    : mode === "market" ? `Read the market · ${PRICES[depth]}`
                    : `Analyze $${ticker || "—"} · ${PRICES[depth]}`;
                  const onClick = !connected ? openConnectModal
                    : !onBase ? () => switchChainAsync({ chainId: base.id }).catch(() => {})
                    : run;
                  return (
                    <button onClick={onClick} disabled={busy || (mode === "stock" && !ticker)}
                      className="rounded-xl border border-signal/50 bg-signal/10 px-9 py-4 font-mono text-sm uppercase tracking-[0.14em] text-signal transition-colors hover:bg-signal/20 disabled:opacity-40">
                      {label}
                    </button>
                  );
                }}
              </ConnectButton.Custom>
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground/70">Pay in USDC on Base · you sign · non-custodial</span>
            </div>
          </div>
        )}

        {/* ── synthesizing: a quiet pipeline that fills as each analyst lands ── */}
        {phase === "synth" && (() => {
          const rows = [
            ...AGENTS.map((a) => ({ label: a.label, sub: mode === "market" ? a.market : a.stock })),
            { label: mode === "market" ? "Chief strategist" : "Portfolio manager", sub: "reconciling the panel" },
          ];
          const linePct = Math.min(100, (Math.max(active, 0) / (rows.length - 1)) * 100);
          return (
            <div className="w-full max-w-md">
              <div className="text-center font-mono text-[0.72rem] uppercase tracking-[0.24em] text-signal">Synthesizing · {mode === "market" ? "US market" : `$${ticker}`}</div>
              <div className="relative mt-10 pl-8">
                <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-white/10">
                  <div className="w-full bg-gradient-to-b from-signal to-signal/50 transition-[height] duration-[900ms] ease-out" style={{ height: `${linePct}%` }} />
                </div>
                {rows.map((r, i) => {
                  const state = i < active ? "done" : i === active ? "live" : "idle";
                  return (
                    <div key={r.label} className="relative pb-8 last:pb-0">
                      <span className={`absolute -left-8 top-0.5 grid h-[15px] w-[15px] place-items-center rounded-full border transition-all duration-700 ${state === "idle" ? "border-white/25 bg-[#060608]" : "border-signal bg-signal"} ${state === "live" ? "nodepulse" : ""}`}>
                        {state === "done" && <svg viewBox="0 0 10 10" className="h-2 w-2 text-[#060608]"><path d="M1.5 5.2 4 7.5 8.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </span>
                      <div className={`transition-opacity duration-700 ${state === "idle" ? "opacity-40" : "opacity-100"}`}>
                        <div className="font-display text-[15px] leading-none text-foreground">{r.label}</div>
                        <div className={`mt-1.5 font-mono text-[0.7rem] ${state === "live" ? "shimmer text-signal" : "text-muted-foreground"}`}>
                          {state === "done" ? "read complete" : state === "live" ? r.sub + "…" : r.sub}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pl-8 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground/60">measuring the tape — a moment</div>
            </div>
          );
        })()}

        {/* ── output ── */}
        {phase === "done" && report && (
          <div className="w-full max-w-2xl">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div className="flex items-center gap-3">
                {mode === "stock" && <Logo s={report.ticker} size={40} />}
                <div>
                  <div className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-signal">The verdict</div>
                  <h2 className="font-display text-3xl tracking-tight">{report.ticker === "MARKET" ? report.name : `$${report.ticker}`} <span className="text-muted-foreground">· {report.ticker === "MARKET" ? "sentiment" : report.name}</span></h2>
                </div>
              </div>
              <button onClick={reset} className="shrink-0 rounded-lg border border-white/12 px-4 py-2 font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground transition-colors hover:border-signal/40 hover:text-signal">New</button>
            </div>
            <div className="whitespace-pre-wrap rounded-2xl border border-signal/25 bg-black/40 p-6 text-[15px] leading-relaxed backdrop-blur-xl">{report.thesis}</div>
            {report.agents && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {AGENTS.filter((a) => report.agents?.[a.key]).map((a) => (
                  <div key={a.key} className="rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur-md">
                    <div className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-signal">{a.label}</div>
                    <div className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/85">{report.agents![a.key]}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 text-center font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/60">Synthesized from real data · not investment advice · urizenfund.com</div>
          </div>
        )}

        {/* ── error ── */}
        {phase === "error" && (
          <div className="w-full max-w-md rounded-2xl border border-[#ff7a7a]/30 bg-black/40 p-8 text-center backdrop-blur-xl">
            <div className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-[#ff7a7a]">Payment didn&apos;t complete</div>
            <div className="mt-3 font-mono text-sm text-foreground/85">{msg || "Something went wrong."}</div>
            <button onClick={reset} className="mt-6 rounded-xl border border-signal/50 bg-signal/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-signal transition-colors hover:bg-signal/20">Try again</button>
          </div>
        )}
      </section>

      <style>{`
        @keyframes kb { 0% { transform: scale(1) translateY(0); } 100% { transform: scale(1.07) translateY(-1.4%); } }
        .kenburns { animation: kb 60s ease-in-out infinite alternate; will-change: transform; }

        /* animated dither — a fine dot-grid, translated by exactly one tile for a seamless drift.
           two layers at different scales/directions interfere into a soft diffusion shimmer. */
        .dither { position: absolute; inset: -8px; mix-blend-mode: screen; will-change: transform, opacity; }
        .dither-a { background-image: radial-gradient(circle, rgba(52,240,3,0.34) 0.6px, transparent 1.1px);
          background-size: 3px 3px; animation: ditherA 6s linear infinite, breathe 7s ease-in-out infinite; }
        .dither-b { background-image: radial-gradient(circle, rgba(52,240,3,0.20) 0.6px, transparent 1.1px);
          background-size: 4px 4px; opacity: .6; animation: ditherB 9s linear infinite, breathe 11s ease-in-out infinite; }
        @keyframes ditherA { to { transform: translate(3px, 3px); } }
        @keyframes ditherB { to { transform: translate(-4px, 4px); } }
        @keyframes breathe { 0%,100% { opacity: .32; } 50% { opacity: .6; } }

        /* smooth node pulse for the live analyst — no jarring ping */
        @keyframes nodepulse { 0% { box-shadow: 0 0 0 0 rgba(52,240,3,.45); } 100% { box-shadow: 0 0 0 9px rgba(52,240,3,0); } }
        .nodepulse { animation: nodepulse 1.9s ease-out infinite; }
        @keyframes sh { 0% { background-position: -140% 0; } 100% { background-position: 140% 0; } }
        .shimmer { background: linear-gradient(90deg, rgba(52,240,3,.45) 0%, rgba(52,240,3,1) 50%, rgba(52,240,3,.45) 100%);
          background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
          animation: sh 2.4s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .kenburns, .dither, .nodepulse, .shimmer { animation: none; } }
      `}</style>
    </main>
  );
}
