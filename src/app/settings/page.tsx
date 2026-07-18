"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/site/site-nav";
import { InlineKeySetup } from "@/components/terminal/key-modal";
import { NewAgentModal } from "@/components/alpha/new-agent-modal";
import { listAgents, saveAgent, deleteAgent, unlockVault, type Agent, type Mandate, type Risk } from "@/lib/agents";
import { UrizenMark } from "@/components/brand/marks";

// A calm, un-cramped home for everything that was jammed into modals: your named agents (personas)
// and your intelligence key. Left nav + focused sections — a real settings page. Saved in-browser.
const MANDATES: Mandate[] = ["Momentum", "DCA", "Rotation", "Yield", "Hedge"];
const RISKS: Risk[] = ["conservative", "balanced", "aggressive"];
const ACTIVE_KEY = "urizen.terminal.agent";

type Section = "agents" | "intelligence" | "data";
const NAV: { id: Section; label: string; glyph: string; hint: string }[] = [
  { id: "agents", label: "Agents", glyph: "✦", hint: "Personas that run the Terminal" },
  { id: "intelligence", label: "Intelligence", glyph: "◈", hint: "Model & API key" },
  { id: "data", label: "Data & privacy", glyph: "▤", hint: "What's stored, and where" },
];

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("agents");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => { unlockVault(); setAgents(listAgents()); try { setActiveId(localStorage.getItem(ACTIVE_KEY)); } catch { /* noop */ } }, []);
  const refresh = () => setAgents(listAgents());
  const setActive = (id: string) => { setActiveId(id); try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* noop */ } };
  const update = (a: Agent, patch: Partial<Agent>) => { saveAgent({ ...a, ...patch }); refresh(); };
  const remove = (id: string) => { deleteAgent(id); if (activeId === id) { setActiveId(null); try { localStorage.removeItem(ACTIVE_KEY); } catch { /* noop */ } } refresh(); };
  const create = (a: Agent) => { saveAgent(a); setActive(a.id); setNewOpen(false); refresh(); };
  const active = agents.find((a) => a.id === activeId) ?? agents[0] ?? null;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-foreground">
      <SiteNav />
      {newOpen && <NewAgentModal onClose={() => setNewOpen(false)} onCreate={create} />}

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-8">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-signal">Settings</p>
            <h1 className="mt-2 font-display text-3xl tracking-tight">Your desk</h1>
          </div>
          <Link href="/terminal" className="rounded-lg border border-border px-4 py-2 font-mono text-[0.68rem] uppercase tracking-widest text-muted-foreground transition-colors hover:border-signal/40 hover:text-signal">← Terminal</Link>
        </header>

        <div className="grid gap-8 md:grid-cols-[210px_1fr]">
          {/* left section nav */}
          <nav className="flex gap-2 overflow-x-auto md:sticky md:top-28 md:h-max md:flex-col md:overflow-visible">
            {NAV.map((n) => {
              const on = n.id === section;
              return (
                <button key={n.id} onClick={() => setSection(n.id)} className={`flex shrink-0 items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors md:w-full ${on ? "border-signal/40 bg-signal/[0.06]" : "border-transparent hover:bg-white/[0.03]"}`}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-[0.9rem] ${on ? "border-signal/40 bg-signal/10 text-signal" : "border-border text-muted-foreground"}`}>{n.glyph}</span>
                  <span className="min-w-0">
                    <span className={`block text-[0.86rem] ${on ? "text-foreground" : "text-muted-foreground"}`}>{n.label}</span>
                    <span className="hidden truncate text-[0.68rem] text-muted-foreground/50 md:block">{n.hint}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          {/* content */}
          <div className="min-w-0">
            {section === "agents" && (
              <section>
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl tracking-tight">Agents</h2>
                    <p className="mt-1 text-[0.84rem] text-muted-foreground">Name your agents and give each a persona. The active one runs the Terminal.</p>
                  </div>
                  <button onClick={() => setNewOpen(true)} className="shrink-0 rounded-lg border border-signal/50 bg-signal/10 px-3.5 py-2 font-mono text-[0.66rem] uppercase tracking-widest text-signal transition-colors hover:bg-signal/20">＋ New</button>
                </div>

                {agents.length === 0 ? (
                  <button onClick={() => setNewOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-6 text-left transition-colors hover:border-signal/40 hover:bg-signal/[0.03]">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-signal/30 bg-signal/10"><UrizenMark className="h-6 w-auto text-signal" /></span>
                    <span><span className="block font-mono text-[0.72rem] uppercase tracking-widest text-signal">Create your first agent</span><span className="mt-1 block text-[0.84rem] text-muted-foreground">A name, a mandate and a risk appetite — that&apos;s the persona your Terminal agent speaks in.</span></span>
                  </button>
                ) : (
                  <div className="grid gap-3">
                    {agents.map((a) => {
                      const on = a.id === active?.id;
                      return (
                        <div key={a.id} className={`rounded-2xl border p-4 transition-colors ${on ? "border-signal/40 bg-signal/[0.04]" : "border-border bg-white/[0.02]"}`}>
                          <div className="flex items-center gap-3">
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${on ? "border-signal/40 bg-signal/10" : "border-border"}`}><UrizenMark className="h-4 w-auto text-signal" /></span>
                            <input value={a.name} onChange={(e) => update(a, { name: e.target.value })} aria-label="Agent name"
                              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 font-display text-base text-foreground transition-colors hover:border-border focus:border-signal/50 focus:outline-none" />
                            {on
                              ? <span className="shrink-0 rounded-full border border-signal/40 bg-signal/10 px-2.5 py-1 font-mono text-[0.54rem] uppercase tracking-widest text-signal">active</span>
                              : <button onClick={() => setActive(a.id)} className="shrink-0 rounded-md border border-border px-2.5 py-1 font-mono text-[0.54rem] uppercase tracking-widest text-muted-foreground transition-colors hover:border-signal/40 hover:text-signal">use</button>}
                            <button onClick={() => remove(a.id)} title="delete" className="shrink-0 px-1 font-mono text-muted-foreground/50 transition-colors hover:text-[#ff5a5a]">✕</button>
                          </div>

                          <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
                            <div>
                              <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-widest text-muted-foreground/60">mandate</span>
                              <div className="flex flex-wrap gap-1">
                                {MANDATES.map((m) => <button key={m} onClick={() => update(a, { mandate: m })} className={`rounded-md border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wide transition-colors ${a.mandate === m ? "border-signal/50 bg-signal/10 text-signal" : "border-border text-muted-foreground hover:text-foreground"}`}>{m}</button>)}
                              </div>
                            </div>
                            <div>
                              <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-widest text-muted-foreground/60">risk</span>
                              <div className="flex flex-wrap gap-1">
                                {RISKS.map((r) => <button key={r} onClick={() => update(a, { risk: r })} className={`rounded-md border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wide transition-colors ${a.risk === r ? "border-signal/50 bg-signal/10 text-signal" : "border-border text-muted-foreground hover:text-foreground"}`}>{r}</button>)}
                              </div>
                            </div>
                          </div>

                          <label className="mt-3.5 block">
                            <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-widest text-muted-foreground/60">directive (optional)</span>
                            <input value={a.note ?? ""} onChange={(e) => update(a, { note: e.target.value || undefined })} placeholder="e.g. only flag setups with a clean risk/reward"
                              className="w-full rounded-lg border border-border bg-[#0d0d10] px-2.5 py-2 text-[0.82rem] text-foreground placeholder:text-muted-foreground/50 focus:border-signal/50 focus:outline-none" />
                          </label>
                          {a.instruments?.length > 0 && <div className="mt-2.5 font-mono text-[0.62rem] text-muted-foreground/60">watch · {a.instruments.join(" · ")}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {section === "intelligence" && (
              <section>
                <h2 className="font-display text-xl tracking-tight">Intelligence</h2>
                <p className="mb-5 mt-1 max-w-prose text-[0.84rem] leading-relaxed text-muted-foreground">Run the agent on Free Mode, or connect your own key for the top models. Your key is encrypted in this browser and sent only to the provider — never to a URIZEN server.</p>
                <div className="max-w-md"><InlineKeySetup /></div>
              </section>
            )}

            {section === "data" && (
              <section>
                <h2 className="font-display text-xl tracking-tight">Data &amp; privacy</h2>
                <p className="mb-5 mt-1 max-w-prose text-[0.84rem] leading-relaxed text-muted-foreground">URIZEN is deliberately account-less. Everything below lives in this browser only.</p>
                <dl className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border/40">
                  {[
                    ["Agents & personas", "urizen.agents.v1"],
                    ["Intelligence key (encrypted)", "urizen.keys.v3"],
                    ["Watchlist", "urizen.terminal.watch"],
                    ["Board layout", "urizen.terminal.board"],
                    ["Active agent", "urizen.terminal.agent"],
                  ].map(([label, key]) => (
                    <div key={key} className="flex items-center justify-between gap-4 bg-[#0b0b0d] px-4 py-3">
                      <dt className="text-[0.84rem] text-foreground/90">{label}</dt>
                      <dd className="font-mono text-[0.68rem] text-muted-foreground">{key}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-[0.76rem] text-muted-foreground/60">Clearing this site&apos;s data in your browser resets all of it. Nothing is stored on our servers.</p>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
