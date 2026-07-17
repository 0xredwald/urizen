"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { UrizenMark } from "@/components/brand/marks";
import { StockLogo } from "@/components/brand/stock-logo";
import { ProviderLogo } from "@/components/alpha/provider-logos";
import { ArtifactView } from "@/components/alpha/artifacts";
import { Markdown } from "@/components/alpha/markdown";
import { Thinking } from "@/components/alpha/thinking";
import { STOCKS } from "@/lib/stocks";
import { addProviderKey, getActiveBinding, setModel, MODELS, newId, type Agent } from "@/lib/agents";
import { runAlpha } from "@/lib/alpha";
import type { Artifact } from "@/lib/alpha-tools";

function Avatar({ size = 32 }: { size?: number }) {
  return <span className="grid shrink-0 place-items-center rounded-lg border border-signal/25 bg-signal/[0.07]" style={{ width: size, height: size }}><UrizenMark className="h-1/2 w-auto text-signal" /></span>;
}
function Bubble({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="msg-in flex gap-3">
      <Avatar />
      <div className={`min-w-0 space-y-3 rounded-2xl rounded-tl-sm border border-border bg-[#0e0e11] px-4 py-3 text-[16px] leading-relaxed text-foreground/95 ${wide ? "flex-1" : ""}`}>{children}</div>
    </div>
  );
}

const FREE = MODELS.openrouter.filter((m) => m.free);

export function Onboarding({ onCreateAgent, onKeyBound, onDone }: {
  onCreateAgent: (a: Agent) => void; onKeyBound: () => void; onDone: () => void;
}) {
  const { address, isConnected } = useAccount();
  // beat: 0,1 auto intro · 2 choice · 3 wallet · 4 intelligence · 5 stocks · 6 create · 7 demo · 8 done
  const [beat, setBeat] = useState(0);
  const [typing, setTyping] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [freeModel, setFreeModel] = useState(FREE[0].id);
  const [picked, setPicked] = useState<string[]>(["NVDA", "AAPL", "MSFT"]);
  const [name, setName] = useState("");
  const [agent, setAgent] = useState<Agent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [demoText, setDemoText] = useState("");
  const [demoArts, setDemoArts] = useState<Artifact[]>([]);
  const [demoStatus, setDemoStatus] = useState<string | null>(null);
  const [demoRun, setDemoRun] = useState(false);

  const advance = (to: number) => { setTyping(true); setTimeout(() => { setTyping(false); setBeat(to); }, 620); };
  // auto-reveal the two short intro beats, then wait for the user at the choice
  useEffect(() => {
    const t1 = setTimeout(() => setBeat(1), 350);
    const t2 = setTimeout(() => setBeat(2), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  useEffect(() => { if (beat === 3 && isConnected) advance(4); }, [beat, isConnected]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }); }, [beat, typing, demoText, demoArts]);

  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : p.length < 8 ? [...p, s] : p));
  const bindKey = () => { const k = keyInput.trim(); if (k.length < 12) return; addProviderKey(k); setKeyInput(""); onKeyBound(); advance(5); };
  const useFree = () => { setModel(freeModel); onKeyBound(); advance(5); };
  const createAgent = () => {
    const a: Agent = { id: newId(), name: name.trim() || "Alpha", mandate: "Momentum", instruments: picked.length ? picked : ["NVDA"], risk: "balanced", createdAt: Date.now() };
    setAgent(a); onCreateAgent(a); advance(7);
  };
  const runDemo = async () => {
    if (!agent) return;
    setDemoRun(true); setDemoStatus("thinking…"); setDemoText(""); setDemoArts([]);
    const binding = getActiveBinding();
    if (!binding) { setDemoStatus(null); setDemoText("Enable free mode or add a key to see the demo."); return; }
    try {
      await runAlpha(agent, binding, [], `Build a brief momentum strategy on ${picked.join(", ")} and show me ${picked[0]}'s chart.`, {
        onStatus: setDemoStatus, onText: (f) => { setDemoText(f); setDemoStatus(null); }, onArtifact: (a) => setDemoArts((p) => [...p, a]),
      });
    } catch (e) { setDemoText(`(${(e as Error).message})`); } finally { setDemoStatus(null); advance(8); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="msg-in flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-[#0a0a0b] shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3"><Avatar size={28} /><span className="text-[16px] font-semibold">Urizen Alpha</span><span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">setup</span></div>
          <button onClick={onDone} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 hover:text-foreground">skip</button>
        </div>

        <div ref={scrollRef} className="flex flex-col gap-5 overflow-y-auto px-6 py-7">
          {/* intro — short, single messages */}
          {beat >= 1 && <Bubble>Hey 👋</Bubble>}
          {beat >= 2 && (
            <Bubble wide>
              <p>I&apos;m <span className="font-semibold text-foreground">Urizen Alpha</span> — your quant trading partner. Charts, comparisons, earnings, strategies, and trades you sign.</p>
              <p className="text-muted-foreground">Use me in the app, or take me as a skill?</p>
              {beat === 2 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={() => advance(3)} className="rounded-lg border border-signal/60 bg-signal/10 px-4 py-2.5 font-mono text-[12px] uppercase tracking-widest text-signal hover:bg-signal/20">Use in the app →</button>
                  <a href="/skill" className="rounded-lg border border-border px-4 py-2.5 font-mono text-[12px] uppercase tracking-widest text-muted-foreground hover:border-signal/40 hover:text-signal">Get the skill ↗</a>
                </div>
              )}
            </Bubble>
          )}

          {/* wallet */}
          {beat >= 3 && (
            <Bubble wide>
              <p>Connect a wallet — you sign every trade.</p>
              {isConnected ? (
                <p className="font-mono text-[13px] text-signal">✓ {address?.slice(0, 6)}…{address?.slice(-4)}{beat === 3 && <button onClick={() => advance(4)} className="ml-3 underline">continue →</button>}</p>
              ) : <div className="flex items-center gap-3 pt-1"><ConnectButton showBalance={false} chainStatus="none" /><button onClick={() => advance(4)} className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-signal">skip →</button></div>}
            </Bubble>
          )}

          {/* intelligence — free (pick model) or own key */}
          {beat >= 4 && (
            <Bubble wide>
              <p>How should I think?</p>
              {beat === 4 ? (
                <div className="grid gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-signal/50 bg-signal/[0.06] p-2">
                    <span className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-widest text-signal"><span>⚡</span> Free mode</span>
                    <select value={freeModel} onChange={(e) => setFreeModel(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1.5 font-mono text-[12px] text-foreground focus:outline-none">
                      {FREE.map((m) => <option key={m.id} value={m.id} className="bg-background">{m.label}</option>)}
                    </select>
                    <button onClick={useFree} className="ml-auto rounded-md border border-signal bg-signal px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-[#04140a] hover:opacity-90">Use free →</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground"><ProviderLogo provider="anthropic" size={15} /><ProviderLogo provider="openai" size={15} /><ProviderLogo provider="openrouter" size={15} /></div>
                    <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && bindKey()} placeholder="or paste your own key" className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-[12px] focus:border-signal/60 focus:outline-none" />
                    <button onClick={bindKey} disabled={keyInput.trim().length < 12} className="rounded-lg border border-border px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:border-signal/40 hover:text-signal disabled:opacity-40">add</button>
                  </div>
                </div>
              ) : <p className="font-mono text-[13px] text-signal">✓ Ready</p>}
            </Bubble>
          )}

          {/* stocks */}
          {beat >= 5 && (
            <Bubble wide>
              <p>Which stocks should I watch?</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {STOCKS.map((s) => { const on = picked.includes(s.symbol); return <button key={s.symbol} onClick={() => beat === 5 && toggle(s.symbol)} className={`flex items-center gap-1.5 rounded-lg border py-1 pl-1 pr-2 transition-colors ${on ? "border-signal/70 bg-signal/10" : "border-border hover:border-signal/30"}`}><StockLogo symbol={s.symbol} size={18} /><span className="font-mono text-[12px]">{s.symbol}</span></button>; })}
              </div>
              {beat === 5 && <button onClick={() => advance(6)} disabled={!picked.length} className="mt-1 rounded-lg border border-signal/60 bg-signal/10 px-4 py-2.5 font-mono text-[12px] uppercase tracking-widest text-signal hover:bg-signal/20 disabled:opacity-40">Continue →</button>}
            </Bubble>
          )}

          {/* create */}
          {beat >= 6 && (
            <Bubble wide>
              <p>Name your agent.</p>
              {!agent ? (
                <div className="flex gap-2 pt-1">
                  <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createAgent()} placeholder="e.g. Alpha Scout" className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-[15px] focus:border-signal/60 focus:outline-none" />
                  <button onClick={createAgent} className="rounded-lg border border-signal bg-signal px-5 py-2.5 font-mono text-[12px] uppercase tracking-widest text-[#04140a] hover:opacity-90">Create</button>
                </div>
              ) : <p className="font-mono text-[13px] text-signal">✓ {agent.name}</p>}
            </Bubble>
          )}

          {/* demo */}
          {agent && beat >= 7 && (
            <Bubble wide>
              {!demoRun ? (
                <><p>Want to see me work? I&apos;ll build a strategy and pull a chart.</p><button onClick={runDemo} className="mt-1 rounded-lg border border-signal/60 bg-signal/10 px-4 py-2.5 font-mono text-[12px] uppercase tracking-widest text-signal hover:bg-signal/20">▶ Show me</button></>
              ) : (
                <>
                  {demoStatus && <Thinking status={demoStatus} />}
                  {demoText && <div className="text-[15px] leading-relaxed"><Markdown text={demoText} /></div>}
                  {demoArts.map((a, i) => <ArtifactView key={i} artifact={a} taker={address ?? null} />)}
                </>
              )}
            </Bubble>
          )}

          {/* done */}
          {beat >= 8 && (
            <Bubble wide>
              <p className="font-semibold text-foreground">You&apos;re set. ✓</p>
              <button onClick={onDone} className="mt-1 rounded-lg border border-signal bg-signal px-5 py-2.5 font-mono text-[12px] uppercase tracking-widest text-[#04140a] hover:opacity-90">Start researching →</button>
            </Bubble>
          )}

          {typing && <div className="msg-in flex gap-3"><Avatar /><div className="rounded-2xl rounded-tl-sm border border-border bg-[#0e0e11] px-4 py-3"><Thinking status="typing…" /></div></div>}
        </div>
      </div>
    </div>
  );
}
