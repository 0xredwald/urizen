"use client";

import { useEffect, useMemo, useState } from "react";
import { StockLogo } from "@/components/brand/stock-logo";
import { EngravedChart } from "@/components/quant/engraved-chart";
import { ConfigGraph, type BlockKind } from "@/components/quant/config-graph";
import { NodeConfig } from "@/components/quant/node-config";
import { AgentChat } from "@/components/quant/agent-chat";
import { BacktestPanel } from "@/components/quant/backtest-panel";
import { SwapPanel } from "@/components/quant/swap-panel";
import { Screener } from "@/components/quant/screener";
import { fetchOhlc, computeIndicators, sma, type OhlcResponse, type Indicators } from "@/lib/quant";
import { defaultConfig, configToCode, configToSkill, type AgentConfig } from "@/lib/agent-graph";
import type { Agent, KeyBinding } from "@/lib/agents";
import type { SwapProposal } from "@/lib/rialto";

type Tab = "agent" | "trade" | "screener";

const RANGES = ["1m", "3m", "6m", "1y"] as const;
const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const money = (x: number) => (x >= 1000 ? x.toFixed(0) : x.toFixed(2));

function regimeTone(r: Indicators["regime"]) {
  return r === "risk-on" ? "text-signal border-signal/40 bg-signal/10"
    : r === "risk-off" ? "text-[#ff5c5c] border-[#ff5c5c]/40 bg-[#ff5c5c]/10"
    : "text-muted-foreground border-border bg-background";
}
function download(name: string, text: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export function AgentConsole({ agent, binding, walletAddress }: { agent: Agent; binding: KeyBinding | null; walletAddress: string | null }) {
  const [tab, setTab] = useState<Tab>("agent");
  const [range, setRange] = useState<(typeof RANGES)[number]>("6m");
  const [responses, setResponses] = useState<Record<string, OhlcResponse>>({});
  const [active, setActive] = useState(agent.instruments[0]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [config, setConfig] = useState<AgentConfig>(() => defaultConfig(agent.instruments, agent.mandate));
  const [selBlock, setSelBlock] = useState<BlockKind | null>(null);
  const [copied, setCopied] = useState(false);
  const [proposal, setProposal] = useState<SwapProposal | null>(null);
  const [tradeBuy, setTradeBuy] = useState(agent.instruments[0]);

  useEffect(() => {
    setActive(agent.instruments[0]);
    setConfig(defaultConfig(agent.instruments, agent.mandate));
    setSelBlock(null);
  }, [agent.id, agent.instruments, agent.mandate]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    Promise.all(agent.instruments.map(async (s) => [s, await fetchOhlc(s, range)] as const))
      .then((pairs) => { if (alive) { setResponses(Object.fromEntries(pairs)); setLoading(false); } })
      .catch((e) => { if (alive) { setErr((e as Error).message); setLoading(false); } });
    return () => { alive = false; };
  }, [agent.id, agent.instruments, range]);

  const data = responses[active];
  const indicators = useMemo<Indicators[]>(
    () => agent.instruments.map((s) => responses[s]).filter(Boolean).map(computeIndicators),
    [responses, agent.instruments],
  );
  const activeInd = useMemo(() => (data ? computeIndicators(data) : null), [data]);
  const smas = useMemo(() => {
    if (!data) return { s20: [] as number[], s50: [] as number[] };
    const c = data.candles.map((k) => k.c);
    return { s20: sma(c, 20), s50: sma(c, 50) };
  }, [data]);

  // ensure the focused symbol's chart is loaded even if it isn't one of the agent's instruments
  useEffect(() => {
    if (!active || responses[active]) return;
    let alive = true;
    fetchOhlc(active, range).then((d) => { if (alive) setResponses((r) => ({ ...r, [active]: d })); }).catch(() => {});
    return () => { alive = false; };
  }, [active, range, responses]);

  const chartPlate = (
    <div className="border border-border bg-card">
      {activeInd && data && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <StockLogo symbol={active} size={34} />
          <div className="mr-auto">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight">{active}</span>
              <span className="font-mono text-lg tabular-nums">${money(activeInd.price)}</span>
              <span className={`font-mono text-xs ${activeInd.change1d >= 0 ? "text-signal" : "text-[#ff5c5c]"}`}>{pct(activeInd.change1d)}</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">real OHLC · {data.candles.length} sessions</span>
          </div>
          <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${regimeTone(activeInd.regime)}`}>{activeInd.regime}</span>
        </div>
      )}
      <div className="px-2 pb-2 pt-1">
        {(loading || !data) && !err && <div className="grid h-[300px] place-items-center font-mono text-xs text-muted-foreground">measuring the deep…</div>}
        {err && <div className="grid h-[300px] place-items-center px-6 text-center font-mono text-xs text-[#ff5c5c]">{err}</div>}
        {!err && data && <EngravedChart candles={data.candles} sma20={smas.s20} sma50={smas.s50} up={(activeInd?.change1d ?? 0) >= 0} />}
      </div>
      {activeInd && (
        <div className="grid grid-cols-3 gap-px border-t border-border bg-border sm:grid-cols-6">
          {[["RSI 14", activeInd.rsi14.toFixed(0)], ["Ann Vol", `${(activeInd.volAnnual * 100).toFixed(0)}%`], ["Sharpe", activeInd.sharpe.toFixed(2)], ["Max DD", `−${(activeInd.maxDrawdown * 100).toFixed(0)}%`], ["3m", pct(activeInd.return3m)], ["Trend", activeInd.trend]].map(([k, v]) => (
            <div key={k} className="bg-card px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</div>
              <div className="font-mono text-sm tabular-nums text-foreground">{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const instrumentBar = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-1.5">
        {agent.instruments.map((s) => (
          <button key={s} onClick={() => setActive(s)}
            className={`flex items-center gap-1.5 border py-1 pl-1 pr-2 transition-colors ${s === active ? "border-signal/70 bg-signal/10" : "border-border bg-background hover:border-signal/30"}`}>
            <StockLogo symbol={s} size={18} />
            <span className="font-mono text-[11px]">{s}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        {RANGES.map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={`border px-2 py-1 font-mono text-[10px] uppercase transition-colors ${range === r ? "border-signal/70 text-signal" : "border-border text-muted-foreground hover:border-signal/30"}`}>{r}</button>
        ))}
      </div>
    </div>
  );

  const TABS: { id: Tab; label: string }[] = [
    { id: "agent", label: "◇ Agent" }, { id: "trade", label: "◈ Trade" }, { id: "screener", label: "⋔ Screener" },
  ];

  return (
    <div className="grid gap-4">
      {/* tab bar — Phantom-style terminal */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${tab === t.id ? "border-signal text-signal" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "agent" && (
        <>
          {instrumentBar}
          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            {chartPlate}
            <AgentChat
              agent={agent} binding={binding} indicators={indicators} config={config}
              onConfig={setConfig} onFocus={(s) => setActive(s)}
              onSwap={(p) => { setProposal(p); setTradeBuy(p.buySym); setTab("trade"); }}
            />
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">The workflow · click a block to configure</span>
              <span className="font-mono text-[10px] text-muted-foreground">{config.summary ? config.summary.slice(0, 64) : "shaped by chat · editable by hand"}</span>
            </div>
            <ConfigGraph config={config} selected={selBlock} onSelect={(k) => setSelBlock(k === selBlock ? null : k)} />
            {selBlock && <NodeConfig block={selBlock} config={config} onChange={setConfig} onClose={() => setSelBlock(null)} />}
          </div>

          <BacktestPanel config={config} series={responses} />

          <div className="border border-border bg-[#08080a]">
            <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">strategy module · typescript</span>
              <div className="flex gap-3">
                <button onClick={() => { navigator.clipboard.writeText(configToCode(agent.name, agent.mandate, agent.risk, config)); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
                  className="font-mono text-[10px] uppercase tracking-widest text-signal hover:underline">{copied ? "copied" : "copy .ts"}</button>
                <button onClick={() => download(`${agent.name.replace(/\s+/g, "-").toLowerCase()}.strategy.ts`, configToCode(agent.name, agent.mandate, agent.risk, config), "text/typescript")}
                  className="font-mono text-[10px] uppercase tracking-widest text-signal hover:underline">.ts</button>
              </div>
            </div>
            <pre className="max-h-64 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">{configToCode(agent.name, agent.mandate, agent.risk, config)}</pre>
          </div>

          <button
            onClick={() => download(`${agent.name.replace(/\s+/g, "-").toLowerCase()}.SKILL.md`, configToSkill(agent.name, agent.mandate, agent.risk, config))}
            className="border border-signal/60 bg-signal/10 px-4 py-2.5 text-center font-mono text-xs uppercase tracking-[0.2em] text-signal transition-colors hover:bg-signal/20">
            ⇩ download skill — run this agent anywhere
          </button>
        </>
      )}

      {tab === "trade" && (
        <>
          {instrumentBar}
          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            {chartPlate}
            <SwapPanel taker={walletAddress} proposal={proposal} onClearProposal={() => setProposal(null)} defaultBuy={tradeBuy} />
          </div>
        </>
      )}

      {tab === "screener" && (
        <Screener
          binding={binding}
          onChart={(s) => { setActive(s); setTab("agent"); }}
          onBuy={(s) => { setActive(s); setTradeBuy(s); setProposal({ sellSym: "USDG", buySym: s, sellAmount: "100", rationale: `Buy ${s} — picked from the screener.` }); setTab("trade"); }}
        />
      )}
    </div>
  );
}
