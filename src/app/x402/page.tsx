"use client";

import { useEffect, useRef, useState } from "react";
import { useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { wrapFetchWithPayment } from "x402-fetch";
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
    try {
      if (chainId !== base.id) { setMsg("Switch to Base in your wallet…"); await switchChainAsync({ chainId: base.id }); }
      setMsg("Confirm the payment in your wallet…");
      const signer = walletClient.extend(publicActions);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pay = wrapFetchWithPayment(fetch, signer as any, BigInt(1_000_000));

      // paid → choreograph the analyst panel while the request is in flight
      setPhase("synth"); setActive(0);
      if (depth === "deep") {
        AGENTS.forEach((_, i) => timers.current.push(setTimeout(() => setActive(i), i * 3000)));
        timers.current.push(setTimeout(() => setActive(AGENTS.length), AGENTS.length * 3000));
      }
      const res = await pay(`/api/x402/analyze?ticker=${encodeURIComponent(query)}&depth=${depth}`);
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
      setMsg(((e as Error)?.message || String(e)).split("\n")[0]);
    }
  };

  const reset = () => { clearTimers(); setPhase("idle"); setActive(-1); setReport(null); setMsg(""); };

  return (
    <main className="relative min-h-screen overflow-hidden text-foreground">
      {/* ── Blake "Ancient of Days" — the measure of the void, made visible ──
          fixed + z-0 (not -z-10) with its own base fill, so main's own layer can't paint over it. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[#07070a]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/blake-ancient.jpg" alt="" className="kenburns absolute inset-0 h-full w-full object-cover object-[center_20%] opacity-[0.82]" />
        {/* warm horizon glow where the sun-disc sits, fading to dark for legibility below */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 50% 8%, rgba(255,150,40,0.10) 0%, transparent 42%), linear-gradient(180deg, rgba(7,7,10,0.15) 0%, rgba(7,7,10,0.30) 40%, rgba(7,7,10,0.78) 74%, #07070a 100%)" }} />
        <div className="aurora absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-signal/40 to-transparent" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "url(/img/noise.svg)" }} />
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

        {/* ── synthesizing ── */}
        {phase === "synth" && (
          <div className="w-full max-w-2xl text-center">
            <div className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-signal">Synthesizing · {mode === "market" ? "US market" : `$${ticker}`}</div>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {AGENTS.map((a, i) => {
                const state = i < active ? "done" : i === active ? "live" : "idle";
                const sub = mode === "market" ? a.market : a.stock;
                return (
                  <div key={a.key} className={`rounded-xl border p-4 text-left transition-all duration-500 ${state === "live" ? "border-signal/60 bg-signal/[0.06] shadow-[0_0_30px_rgba(52,240,3,0.15)]" : state === "done" ? "border-signal/25 bg-white/[0.02]" : "border-white/8 bg-white/[0.01] opacity-45"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm text-foreground">{a.label}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${state === "live" ? "animate-ping bg-signal" : state === "done" ? "bg-signal" : "bg-white/20"}`} />
                    </div>
                    <div className="mt-1 font-mono text-[0.68rem] text-muted-foreground">{state === "done" ? "read complete" : state === "live" ? sub + "…" : sub}</div>
                  </div>
                );
              })}
            </div>
            <div className={`mx-auto mt-6 w-full max-w-md rounded-xl border p-4 transition-all duration-500 ${active >= AGENTS.length ? "border-signal/60 bg-signal/[0.06] shadow-[0_0_30px_rgba(52,240,3,0.15)]" : "border-white/8 opacity-45"}`}>
              <div className="font-display text-sm">{mode === "market" ? "Chief strategist" : "Portfolio manager"}</div>
              <div className="mt-1 font-mono text-[0.68rem] text-muted-foreground">{active >= AGENTS.length ? "reconciling the panel into a verdict…" : "awaiting the analysts"}</div>
            </div>
            <div className="mt-6 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground/70">measuring the tape — this takes a moment</div>
          </div>
        )}

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
        @keyframes kb { 0% { transform: scale(1) translateY(0); } 100% { transform: scale(1.08) translateY(-1.5%); } }
        .kenburns { animation: kb 48s ease-in-out infinite alternate; }
        @keyframes drift { 0% { transform: translate(-3%, 2%); opacity: .8; } 100% { transform: translate(3%, -2%); opacity: 1; } }
        .aurora { animation: drift 24s ease-in-out infinite alternate; background:
          radial-gradient(40% 46% at 20% 82%, rgba(52,240,3,0.12), transparent 62%),
          radial-gradient(42% 48% at 84% 88%, rgba(52,240,3,0.09), transparent 64%); }
        @media (prefers-reduced-motion: reduce) { .kenburns, .aurora { animation: none; } }
      `}</style>
    </main>
  );
}
