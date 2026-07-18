"use client";

import { useEffect, useState } from "react";
import { SiteNav } from "@/components/site/site-nav";
import { InlineKeySetup } from "@/components/terminal/key-modal";
import { NewAgentModal } from "@/components/alpha/new-agent-modal";
import { listAgents, saveAgent, deleteAgent, unlockVault, type Agent, type Mandate, type Risk } from "@/lib/agents";
import { UrizenMark } from "@/components/brand/marks";

// A calm, un-cramped home for everything that was jammed into modals: your named agents (personas)
// and your intelligence key. Everything here is saved in your browser — no account, no server.
const MANDATES: Mandate[] = ["Momentum", "DCA", "Rotation", "Yield", "Hedge"];
const RISKS: Risk[] = ["conservative", "balanced", "aggressive"];
const ACTIVE_KEY = "urizen.terminal.agent";

export default function SettingsPage() {
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

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-8">
        <header className="mb-10">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.24em] text-signal">Settings</p>
          <h1 className="mt-1.5 font-display text-3xl tracking-tight">Your desk</h1>
          <p className="mt-2 max-w-prose text-[0.9rem] leading-relaxed text-muted-foreground">Set up your agents and your intelligence key. Everything is saved locally in this browser — no account, nothing leaves your device except calls to your own model provider.</p>
        </header>

        {/* ── agents / personas ── */}
        <section className="mb-12">
          <div className="mb-4 flex items-end justify-between border-b border-border pb-2.5">
            <div>
              <h2 className="font-display text-lg tracking-tight">Agents</h2>
              <p className="mt-0.5 text-[0.8rem] text-muted-foreground">Name your agents and give each a persona. The active one runs the Terminal.</p>
            </div>
            <button onClick={() => setNewOpen(true)} className="shrink-0 rounded-lg border border-signal/50 bg-signal/10 px-3.5 py-2 font-mono text-[0.68rem] uppercase tracking-widest text-signal transition-colors hover:bg-signal/20">＋ New agent</button>
          </div>

          {agents.length === 0 ? (
            <button onClick={() => setNewOpen(true)} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-5 text-left transition-colors hover:border-signal/40 hover:bg-signal/[0.03]">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-signal/30 bg-signal/10"><UrizenMark className="h-5 w-auto text-signal" /></span>
              <span><span className="block font-mono text-[0.74rem] uppercase tracking-widest text-signal">Create your first agent</span><span className="mt-0.5 block text-[0.82rem] text-muted-foreground">A name, a mandate and a risk appetite — that&apos;s the persona your Terminal agent speaks in.</span></span>
            </button>
          ) : (
            <div className="grid gap-3">
              {agents.map((a) => {
                const on = a.id === active?.id;
                return (
                  <div key={a.id} className={`rounded-xl border p-4 transition-colors ${on ? "border-signal/40 bg-signal/[0.04]" : "border-border bg-white/[0.02]"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${on ? "border-signal/40 bg-signal/10" : "border-border"}`}><UrizenMark className="h-4 w-auto text-signal" /></span>
                      <input value={a.name} onChange={(e) => update(a, { name: e.target.value })}
                        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 font-display text-base text-foreground transition-colors hover:border-border focus:border-signal/50 focus:outline-none" />
                      {on
                        ? <span className="shrink-0 rounded-full border border-signal/40 bg-signal/10 px-2.5 py-1 font-mono text-[0.56rem] uppercase tracking-widest text-signal">active</span>
                        : <button onClick={() => setActive(a.id)} className="shrink-0 rounded-md border border-border px-2.5 py-1 font-mono text-[0.56rem] uppercase tracking-widest text-muted-foreground transition-colors hover:border-signal/40 hover:text-signal">use</button>}
                      <button onClick={() => remove(a.id)} title="delete" className="shrink-0 px-1 font-mono text-muted-foreground/50 transition-colors hover:text-[#ff5a5a]">✕</button>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block font-mono text-[0.56rem] uppercase tracking-widest text-muted-foreground/60">mandate</span>
                        <div className="flex flex-wrap gap-1">
                          {MANDATES.map((m) => <button key={m} onClick={() => update(a, { mandate: m })} className={`rounded-md border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wide transition-colors ${a.mandate === m ? "border-signal/50 bg-signal/10 text-signal" : "border-border text-muted-foreground hover:text-foreground"}`}>{m}</button>)}
                        </div>
                      </label>
                      <label className="block">
                        <span className="mb-1 block font-mono text-[0.56rem] uppercase tracking-widest text-muted-foreground/60">risk</span>
                        <div className="flex flex-wrap gap-1">
                          {RISKS.map((r) => <button key={r} onClick={() => update(a, { risk: r })} className={`rounded-md border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wide transition-colors ${a.risk === r ? "border-signal/50 bg-signal/10 text-signal" : "border-border text-muted-foreground hover:text-foreground"}`}>{r}</button>)}
                        </div>
                      </label>
                    </div>

                    <label className="mt-3 block">
                      <span className="mb-1 block font-mono text-[0.56rem] uppercase tracking-widest text-muted-foreground/60">directive (optional)</span>
                      <input value={a.note ?? ""} onChange={(e) => update(a, { note: e.target.value || undefined })} placeholder="e.g. only flag setups with a clean risk/reward"
                        className="w-full rounded-md border border-border bg-[#0d0d10] px-2.5 py-1.5 text-[0.82rem] text-foreground placeholder:text-muted-foreground/50 focus:border-signal/50 focus:outline-none" />
                    </label>
                    {a.instruments?.length > 0 && <div className="mt-2 font-mono text-[0.62rem] text-muted-foreground/60">watch · {a.instruments.join(" · ")}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── intelligence / key ── */}
        <section className="mb-12">
          <div className="mb-4 border-b border-border pb-2.5">
            <h2 className="font-display text-lg tracking-tight">Intelligence</h2>
            <p className="mt-0.5 text-[0.8rem] text-muted-foreground">Run the agent on Free Mode, or connect your own key for the top models — encrypted in your browser, sent only to the provider.</p>
          </div>
          <div className="max-w-md"><InlineKeySetup /></div>
        </section>

        <p className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground/40">Saved locally · urizen.agents.v1 · urizen.keys.v3</p>
      </main>
    </div>
  );
}
