"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { ArtifactView } from "@/components/alpha/artifacts";
import { NewAgentModal } from "@/components/alpha/new-agent-modal";
import { Onboarding } from "@/components/alpha/onboarding";
import { PhantomSwap } from "@/components/alpha/phantom-swap";
import { WalletBalances } from "@/components/alpha/wallet-balances";
import { SkillsModal, SlashMenu, matchSlash, resolveSlashCommand } from "@/components/alpha/skills-panel";
import { ALL_SKILL_IDS, type Skill } from "@/components/alpha/skills";
import { matchAt, parseSources, type Source } from "@/components/alpha/sources";
import { IconSparkles } from "@tabler/icons-react";
import { Markdown } from "@/components/alpha/markdown";
import { ModelPicker } from "@/components/alpha/model-picker";
import { Thinking } from "@/components/alpha/thinking";
import { UrizenMark } from "@/components/brand/marks";
import { runAlpha } from "@/lib/alpha";
import type { Artifact } from "@/lib/alpha-tools";
import { ProviderLogo, PROVIDER_LABEL } from "@/components/alpha/provider-logos";
import {
  listAgents, saveAgent, deleteAgent,
  listProviderKeys, addProviderKey, removeProviderKey, setActiveProvider, getActiveBinding, getActiveProvider,
  getActiveModel, setModel, MODELS, unlockVault,
  type Agent, type KeyBinding, type Provider,
} from "@/lib/agents";

type Msg = { id: string; role: "user" | "assistant"; text?: string; artifacts?: Artifact[]; status?: string; error?: string };

const uid = () => Math.random().toString(36).slice(2);

function Avatar({ size = 28 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-md border border-signal/25 bg-signal/[0.07]" style={{ width: size, height: size }}>
      <UrizenMark className="h-1/2 w-auto text-signal" />
    </span>
  );
}

const STARTERS = [
  "Research NVIDIA's latest earnings",
  "Show the strongest momentum stocks right now",
  "Compare AMD vs NVDA",
  "Build a momentum strategy on the Mag 7",
];

function defaultAgent(): Agent {
  return { id: "alpha", name: "Urizen Alpha", mandate: "Momentum", instruments: ["NVDA", "AAPL", "MSFT", "TSLA", "PLTR"], risk: "balanced", createdAt: 0 };
}

export function AlphaChat() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selId, setSelId] = useState<string>("alpha");
  const [convos, setConvos] = useState<Record<string, Msg[]>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showSwap, setShowSwap] = useState(true); // swap dock visible by default
  const [tradeLink, setTradeLink] = useState<{ sell: string; buy: string; amount: string; auto: boolean } | null>(null); // a proposed trade from the bot (?sell=…)
  const [onboarded, setOnboarded] = useState(true); // assume done until we read storage (avoids flash)
  const [hydrated, setHydrated] = useState(false);
  const [enabled, setEnabled] = useState<string[]>(ALL_SKILL_IDS); // which skills the agent may call
  const [showSkills, setShowSkills] = useState(false);
  const [slashIdx, setSlashIdx] = useState(0);
  const [atIdx, setAtIdx] = useState(0);

  const { address: addr, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [binding, setBinding] = useState<KeyBinding | null>(null);
  const [providerKeys, setProviderKeys] = useState<{ provider: Provider; last4: string }[]>([]);
  const [activeProvider, setActiveProv] = useState<Provider | null>(null);
  const [model, setModelState] = useState<string | undefined>(undefined);
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const refreshKeys = () => { setBinding(getActiveBinding()); setProviderKeys(listProviderKeys()); setActiveProv(getActiveProvider()); setModelState(getActiveModel()); };

  useEffect(() => {
    let alive = true;
    (async () => {
      // decrypt the key vault into memory BEFORE reading any keys
      await unlockVault();
      if (!alive) return;
      refreshKeys();
      const stored = listAgents();
      setAgents([defaultAgent(), ...stored.filter((a) => a.id !== "alpha")]);
      // restore saved chat history
      try { const raw = localStorage.getItem("urizen.convos.v1"); if (raw) setConvos(JSON.parse(raw)); } catch { /* noop */ }
      setOnboarded(localStorage.getItem("urizen.onboarded.v1") === "1");
      try { const raw = localStorage.getItem("urizen.skills.v1"); if (raw) { const ids = JSON.parse(raw); if (Array.isArray(ids)) setEnabled(ids.filter((id) => ALL_SKILL_IDS.includes(id))); } } catch { /* noop */ }
      setHydrated(true);
    })();
    return () => { alive = false; };
  }, []);

  // persist which skills are on
  useEffect(() => { if (hydrated) try { localStorage.setItem("urizen.skills.v1", JSON.stringify(enabled)); } catch { /* noop */ } }, [enabled, hydrated]);
  const toggleSkill = (id: string) => setEnabled((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  // persist chat history (guard against quota)
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem("urizen.convos.v1", JSON.stringify(convos)); } catch { /* quota — skip */ }
  }, [convos, hydrated]);

  const finishOnboarding = () => { localStorage.setItem("urizen.onboarded.v1", "1"); setOnboarded(true); };

  // opened from the Telegram bot's "Connect wallet" button (?connect=1) or a proposed swap (?sell=…):
  // auto-open the wallet-connect modal so the user is prompted immediately instead of a dead app.
  const connectPrompted = useRef(false);
  useEffect(() => {
    if (connectPrompted.current || typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if ((q.get("connect") === "1" || q.has("sell")) && !isConnected && openConnectModal) {
      connectPrompted.current = true;
      openConnectModal();
    }
  }, [isConnected, openConnectModal]);

  // if opened from the bot with a signed tg param, report the connected wallet back so the bot can
  // detect it (once per session). Signature is verified server-side; nothing sensitive is exposed.
  const linkReported = useRef(false);
  useEffect(() => {
    if (linkReported.current || typeof window === "undefined" || !isConnected || !addr) return;
    const q = new URLSearchParams(window.location.search);
    const tg = q.get("tg"), sig = q.get("sig");
    if (!tg || !sig) return;
    linkReported.current = true;
    void fetch("/api/telegram/link", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tg: Number(tg), address: addr, sig }),
    }).catch(() => {});
  }, [isConnected, addr]);

  // opened from a bot "Open & sign" button (?sell=&buy=&amount=): surface the exact proposed trade as
  // a focused, pre-filled overlay — ready to sign the moment the wallet reconnects — instead of a bare page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const sell = q.get("sell");
    // a specific trade from the bot → auto-sign (your wallet pops, you just approve); ?swap=1 → manual configurator
    if (sell) setTradeLink({ sell, buy: q.get("buy") || "NVDA", amount: q.get("amount") || "100", auto: true });
    else if (q.get("swap") === "1") setTradeLink({ sell: "USDG", buy: "NVDA", amount: "100", auto: false });
  }, []);

  // pin to bottom only when the user is already near it, and instantly (no smooth animation
  // re-firing on every streamed token — that's what made charts "jump around")
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [convos, selId, busy]);

  const agent = agents.find((a) => a.id === selId) ?? agents[0] ?? defaultAgent();
  const slashItems = matchSlash(input);
  const pickSkill = (s: Skill) => {
    if (s.arg) { setInput(s.command + " "); setSlashIdx(0); } // wait for the argument
    else send(s.prompt(""));                                   // fire immediately
  };
  const atItems = slashItems.length ? [] : matchAt(input);
  const pickSource = (s: Source) => { setInput((prev) => prev.replace(/@\w*$/, s.command + " ")); setAtIdx(0); };
  const msgs = convos[selId] ?? [];
  const setMsgs = (fn: (m: Msg[]) => Msg[]) => setConvos((c) => ({ ...c, [selId]: fn(c[selId] ?? []) }));

  const bindKey = () => { const k = keyInput.trim(); if (k.length < 12) return; addProviderKey(k); setKeyInput(""); setShowKey(false); refreshKeys(); };
  const pickProvider = (p: Provider) => { setActiveProvider(p); refreshKeys(); };
  const dropProvider = (p: Provider) => { removeProviderKey(p); refreshKeys(); };
  const pickModel = (m: string) => { setModel(m); refreshKeys(); };

  const createAgent = (a: Agent) => { const next = saveAgent(a); setAgents([defaultAgent(), ...next.filter((x) => x.id !== "alpha")]); setSelId(a.id); setShowNew(false); };
  const removeAgent = (id: string) => { const next = deleteAgent(id); setAgents([defaultAgent(), ...next.filter((x) => x.id !== "alpha")]); if (selId === id) setSelId("alpha"); };

  const send = async (text: string) => {
    const raw = text.trim();
    if (!raw || busy) return;
    if (!isConnected) { openConnectModal?.(); return; }
    if (!binding) { setShowKey(true); return; }
    // "/command arg" launches a skill (expand to its prompt); "@source" mentions scope which
    // data the agent consults this turn. display = what the user sees; sent = what the agent gets.
    const slash = resolveSlashCommand(raw);
    let display = raw, sent = raw, turnEnabled = enabled;
    if (slash) {
      display = sent = slash.skill.prompt(slash.arg);
      if (!enabled.includes(slash.skill.id)) turnEnabled = [...enabled, slash.skill.id];
    } else {
      const src = parseSources(raw);
      if (src.labels.length) {
        sent = `${raw}\n\n(Focus your research on these sources: ${src.labels.join(", ")}.)`;
        turnEnabled = [...new Set([...enabled, ...src.toolIds])];
      }
    }
    const history = (convos[selId] ?? []).filter((m) => m.text).map((m) => ({ role: m.role, content: m.text as string }));
    const asstId = uid();
    setMsgs((m) => [...m, { id: uid(), role: "user", text: display }, { id: asstId, role: "assistant", status: "thinking…", artifacts: [] }]);
    setInput(""); setSlashIdx(0); setAtIdx(0); setBusy(true); setStreamingId(asstId);

    const patch = (p: Partial<Msg>) => setMsgs((m) => m.map((x) => (x.id === asstId ? { ...x, ...p } : x)));
    try {
      const res = await runAlpha(agent, binding, history, sent, {
        onStatus: (s) => patch({ status: s }),
        onText: (full) => patch({ text: full, status: undefined }),
        onArtifact: (a) => setMsgs((m) => m.map((x) => (x.id === asstId ? { ...x, artifacts: [...(x.artifacts ?? []), a] } : x))),
      }, turnEnabled);
      patch({ text: res.text || (res.artifacts.length ? "" : "…"), status: undefined });
    } catch (e) {
      patch({ status: undefined, error: (e as Error).message });
    } finally {
      setBusy(false); setStreamingId(null);
    }
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground">
      {/* ── sidebar ── */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border md:flex">
        <Link href="/" className="flex items-center gap-2.5 border-b border-border px-4 py-4">
          <UrizenMark className="h-6 w-auto text-signal" />
          <span className="text-base font-semibold tracking-tight">Urizen Alpha</span>
        </Link>

        <div className="grid gap-2 p-3">
          <button onClick={() => setShowNew(true)} className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-signal/40 hover:text-signal">
            ＋ New agent
          </button>
          <button onClick={() => setShowSwap((v) => !v)} className={`flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2.5 font-mono text-[11px] uppercase tracking-widest transition-colors ${showSwap ? "border-signal/50 bg-signal/10 text-signal" : "border-border text-muted-foreground hover:border-signal/40 hover:text-signal"}`}>
            ◈ {showSwap ? "Hide trade" : "Trade stocks"}
          </button>
          <button onClick={() => setShowSkills(true)} className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-signal/40 hover:text-signal">
            <IconSparkles size={13} /> Skills · {enabled.length}/{ALL_SKILL_IDS.length}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          <div className="px-2 py-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Agents</div>
          {agents.map((a) => (
            <button key={a.id} onClick={() => setSelId(a.id)}
              className={`group mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors ${selId === a.id ? "bg-signal/10" : "hover:bg-white/[0.04]"}`}>
              <Avatar size={26} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] leading-tight">{a.name}</div>
                <div className="truncate font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{a.mandate}</div>
              </div>
              {a.id !== "alpha" && (
                <span onClick={(e) => { e.stopPropagation(); removeAgent(a.id); }} className="text-muted-foreground opacity-0 transition-opacity hover:text-[#ff5c5c] group-hover:opacity-100">✕</span>
              )}
            </button>
          ))}
        </div>

        {/* account */}
        <div className="grid gap-2.5 border-t border-border p-3">
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
              const ready = mounted;
              if (!ready) return <div className="h-9" />;
              if (!account) return (
                <button onClick={openConnectModal} className="rounded-md border border-border px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-signal/40 hover:text-signal">Connect wallet</button>
              );
              if (chain?.unsupported) return (
                <button onClick={openChainModal} className="rounded-md border border-[#ff5c5c]/40 bg-[#ff5c5c]/5 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-[#ff5c5c]">Wrong network</button>
              );
              return (
                <button onClick={openAccountModal} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 font-mono text-[12px] transition-colors hover:border-signal/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal" />{account.displayName}
                </button>
              );
            }}
          </ConnectButton.Custom>

          {/* Urizen Free Mode when no user key is bound */}
          {providerKeys.length === 0 && (
            <div className="flex items-center gap-2 rounded-md border border-signal/40 bg-signal/[0.06] px-2.5 py-2">
              <span className="text-signal">⚡</span>
              <div className="flex-1 leading-tight">
                <div className="font-mono text-[11px] text-signal">Urizen Free Mode</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Llama 3.3 70B</div>
              </div>
              <span className="rounded-full bg-signal/20 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-signal">free</span>
            </div>
          )}

          {/* provider keys — click to activate */}
          {providerKeys.length > 0 && (
            <div className="grid gap-1">
              {providerKeys.map(({ provider, last4 }) => {
                const on = activeProvider === provider;
                return (
                  <div key={provider} className={`group flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors ${on ? "border-signal/50 bg-signal/[0.06]" : "border-border hover:border-signal/30"}`}>
                    <ProviderLogo provider={provider} size={15} className={on ? "text-signal" : "text-muted-foreground"} />
                    <button onClick={() => pickProvider(provider)} className="flex-1 text-left font-mono text-[11px] text-foreground">
                      {PROVIDER_LABEL[provider]} <span className="text-muted-foreground">····{last4}</span>
                    </button>
                    {on && <span className="font-mono text-[9px] uppercase tracking-widest text-signal">active</span>}
                    <button onClick={() => dropProvider(provider)} className="text-[11px] text-muted-foreground opacity-0 transition-opacity hover:text-[#ff5c5c] group-hover:opacity-100">✕</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* model picker for the active provider */}
          {activeProvider && (
            <label className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Model</span>
              <select value={model ?? MODELS[activeProvider][0].id} onChange={(e) => pickModel(e.target.value)}
                className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-foreground focus:outline-none">
                {MODELS[activeProvider].map((m) => <option key={m.id} value={m.id} className="bg-background">{m.label}</option>)}
              </select>
            </label>
          )}

          {showKey ? (
            <div className="flex gap-1.5">
              <input autoFocus type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && bindKey()} placeholder="sk-ant-… · sk-… · sk-or-…"
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 font-mono text-[11px] focus:border-signal/60 focus:outline-none" />
              <button onClick={bindKey} className="rounded-md border border-signal/50 px-2.5 py-1.5 font-mono text-[10px] uppercase text-signal hover:bg-signal/10">add</button>
            </div>
          ) : (
            <button onClick={() => setShowKey(true)} className="flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-signal/40 hover:text-signal">
              <ProviderLogo provider="anthropic" size={12} /><ProviderLogo provider="openai" size={12} /><ProviderLogo provider="openrouter" size={12} /> ＋ Add key
            </button>
          )}
        </div>
      </aside>

      {/* ── main ── */}
      <div className="relative isolate flex min-w-0 flex-1 flex-col">
        {/* William Blake engraving behind the conversation — present but not loud */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/blake-ancient.webp" alt="" className="absolute -right-16 top-1/2 h-[135%] w-auto -translate-y-1/2 object-contain opacity-[0.09] grayscale contrast-125"
            style={{ maskImage: "radial-gradient(65% 65% at 62% 50%, #000, transparent)", WebkitMaskImage: "radial-gradient(65% 65% at 62% 50%, #000, transparent)" }} />
        </div>
        {/* top bar */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="md:hidden"><Avatar size={28} /></span>
          {/* title lives in the left sidebar; on mobile (no sidebar) keep just the name */}
          <div className="mr-auto"><span className="text-base font-semibold md:hidden">{agent.name}</span></div>
          <ModelPicker onChange={refreshKeys} />
          {msgs.length > 0 && <button onClick={() => setMsgs(() => [])} className="rounded-md border border-border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:border-signal/40 hover:text-signal">New chat</button>}
        </div>

        {/* messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {msgs.length === 0 ? (
              <div className="grid min-h-[52vh] place-items-center">
                <div className="w-full text-center">
                  <div className="mx-auto mb-5 w-fit"><Avatar size={56} /></div>
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Meet {agent.name}.</h1>
                  <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-muted-foreground">
                    Your quant trading partner — institutional-grade research on Robinhood Chain. Research
                    companies, analyse charts, compare businesses, explain earnings, build strategies, and trade.
                    <span className="text-foreground"> Just ask.</span>
                  </p>
                  <div className="mx-auto mt-6 grid max-w-lg gap-2 sm:grid-cols-2">
                    {STARTERS.map((s) => (
                      <button key={s} onClick={() => send(s)} className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-left text-[13px] text-foreground/90 transition-colors hover:border-signal/40 hover:bg-signal/[0.04]">{s}</button>
                    ))}
                  </div>
                  {!binding && <p className="mt-5 font-mono text-[11px] text-muted-foreground">Add an Anthropic or OpenRouter key (left) to begin — it stays in your browser.</p>}
                </div>
              </div>
            ) : (
              <div className="grid gap-6">
                {msgs.map((m) => (
                  <div key={m.id} className={`msg-in ${m.role === "user" ? "flex justify-end" : "flex gap-3"}`}>
                    {m.role === "assistant" && <span className="mt-0.5"><Avatar size={28} /></span>}
                    <div className={m.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-sm border border-signal/25 bg-signal/[0.07] px-4 py-2.5 text-base leading-relaxed" : "min-w-0 flex-1 space-y-3"}>
                      {m.status && <Thinking status={m.status} />}
                      {m.artifacts?.map((a, i) => <ArtifactView key={i} artifact={a} taker={addr ?? null} />)}
                      {m.text && (
                        <div className="text-base leading-relaxed text-foreground/95">
                          <Markdown text={m.text} />
                          {busy && m.id === streamingId && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-signal align-middle" />}
                        </div>
                      )}
                      {m.error && <div className="rounded-md border border-[#ff5c5c]/40 bg-[#ff5c5c]/5 px-3 py-2 font-mono text-[12px] text-[#ff5c5c]">{m.error}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* composer */}
        <div className="border-t border-border px-4 py-3">
          <div className="relative mx-auto max-w-3xl">
            {slashItems.length > 0 && <SlashMenu items={slashItems} active={slashIdx} onPick={pickSkill} title="Skills" />}
            {atItems.length > 0 && <SlashMenu items={atItems} active={atIdx} onPick={pickSource} title="Sources · pick what to research from" />}
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 focus-within:border-signal/50">
              <textarea
                value={input}
                onChange={(e) => { setInput(e.target.value); setSlashIdx(0); setAtIdx(0); }}
                onKeyDown={(e) => {
                  if (slashItems.length > 0) {
                    if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx((i) => (i + 1) % slashItems.length); return; }
                    if (e.key === "ArrowUp") { e.preventDefault(); setSlashIdx((i) => (i - 1 + slashItems.length) % slashItems.length); return; }
                    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickSkill(slashItems[slashIdx] ?? slashItems[0]); return; }
                    if (e.key === "Escape") { e.preventDefault(); setInput(""); return; }
                  }
                  if (atItems.length > 0) {
                    if (e.key === "ArrowDown") { e.preventDefault(); setAtIdx((i) => (i + 1) % atItems.length); return; }
                    if (e.key === "ArrowUp") { e.preventDefault(); setAtIdx((i) => (i - 1 + atItems.length) % atItems.length); return; }
                    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickSource(atItems[atIdx] ?? atItems[0]); return; }
                    if (e.key === "Escape") { e.preventDefault(); setAtIdx(0); return; }
                  }
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
                }}
                rows={1}
                placeholder={!isConnected ? "Connect your wallet to start chatting…" : `Ask ${agent.name} anything — / for a skill, @ for a source…`}
                className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-1.5 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              <button onClick={() => send(input)} disabled={busy || !input.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-signal text-black transition-opacity hover:opacity-90 disabled:opacity-30" aria-label="send">
                ↑
              </button>
            </div>
          </div>
          <p className="mx-auto mt-1.5 max-w-3xl text-center font-mono text-[9px] text-muted-foreground">Urizen Alpha can be wrong. Research, not investment advice. You sign every trade.</p>
        </div>
      </div>

      {/* ── persistent trade dock (Phantom-style, always visible) ── */}
      {showSwap && (
        <aside className="hidden w-[400px] shrink-0 flex-col border-l border-border bg-[#0b0b0d] lg:flex">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <span className="flex items-center gap-2 text-[15px] font-semibold"><span className="text-signal">◈</span> Trade</span>
            <button onClick={() => setShowSwap(false)} className="text-muted-foreground transition-colors hover:text-foreground" aria-label="hide">✕</button>
          </div>
          <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-5">
            <WalletBalances />
            <PhantomSwap defaultBuy={agent.instruments[0] ?? "NVDA"} />
          </div>
        </aside>
      )}

      {/* proposed trade from the bot — a focused, pre-filled sign card on ANY screen (the dock above is
          desktop-only, so mobile users from Telegram would otherwise land on a bare page). Ready to sign
          the instant the wallet reconnects. */}
      {tradeLink && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setTradeLink(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"><span className="text-signal">◈</span> Sign your trade</span>
              <button onClick={() => setTradeLink(null)} className="text-sm text-muted-foreground transition-colors hover:text-foreground" aria-label="close">✕</button>
            </div>
            <PhantomSwap defaultSell={tradeLink.sell} defaultBuy={tradeLink.buy} defaultAmount={tradeLink.amount} autoSign={tradeLink.auto} />
          </div>
        </div>
      )}

      {showSkills && <SkillsModal enabled={enabled} onToggle={toggleSkill} onSet={setEnabled} onClose={() => setShowSkills(false)} />}
      {showNew && <NewAgentModal onClose={() => setShowNew(false)} onCreate={createAgent} />}
      {hydrated && !onboarded && <Onboarding onCreateAgent={createAgent} onKeyBound={refreshKeys} onDone={finishOnboarding} />}
    </div>
  );
}
