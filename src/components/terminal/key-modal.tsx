"use client";

import { useEffect, useState } from "react";
import { addProviderKey, listProviderKeys, removeProviderKey, setModel, getActiveModel, isFreeMode, MODELS, getActiveProvider, type Provider } from "@/lib/agents";

// Connect intelligence — the terminal's agent runs on Free Mode by default (our server key + a free
// model) or your own key (Anthropic / OpenAI / OpenRouter), held encrypted in your browser and sent
// straight to the provider, never to a URIZEN server. Same vault as Alpha.
export function KeyModal({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
  const [keys, setKeys] = useState<{ provider: Provider; last4: string }[]>([]);
  const [free, setFree] = useState(true);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [model, setModelState] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => {
    setKeys(listProviderKeys());
    setFree(isFreeMode());
    setProvider(getActiveProvider());
    setModelState(getActiveModel());
  };
  useEffect(() => { if (open) refresh(); }, [open]);
  if (!open) return null;

  const save = () => {
    const k = input.trim();
    if (!k) return;
    try { addProviderKey(k); setInput(""); setErr(null); refresh(); onChanged(); }
    catch (e) { setErr((e as Error).message); }
  };
  const drop = (p: Provider) => { removeProviderKey(p); refresh(); onChanged(); };
  const pickModel = (m: string) => { setModel(m); setModelState(m); onChanged(); };

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-[#0b0b0d] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg tracking-tight">Connect intelligence</h2>
          <button onClick={onClose} className="font-mono text-sm text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <p className="mt-1 text-[0.8rem] leading-relaxed text-muted-foreground">
          The agent runs on <span className="text-signal">Free Mode</span> by default. Add your own key for the top models — it&apos;s encrypted in your browser and sent only to the provider, never to us.
        </p>

        {/* current mode */}
        <div className="mt-4 rounded-xl border border-border bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            <span className="font-mono text-[0.72rem] uppercase tracking-widest text-foreground">{free ? "Free Mode" : `${provider} · connected`}</span>
          </div>
          {keys.length > 0 && (
            <div className="mt-2 space-y-1">
              {keys.map((k) => (
                <div key={k.provider} className="flex items-center justify-between font-mono text-[0.72rem] text-muted-foreground">
                  <span>{k.provider} ····{k.last4}</span>
                  <button onClick={() => drop(k.provider)} className="text-muted-foreground/60 hover:text-[#ff5a5a]">remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* add a key */}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-[#0d0d10] p-1.5 focus-within:border-signal/40">
          <input value={input} onChange={(e) => setInput(e.target.value)} type="password" placeholder="paste sk-ant… / sk-… / sk-or…"
            className="min-w-0 flex-1 bg-transparent px-2 py-1.5 font-mono text-[0.8rem] outline-none placeholder:text-muted-foreground/50" />
          <button onClick={save} disabled={!input.trim()} className="rounded-lg bg-signal/15 px-3 py-1.5 font-mono text-[0.72rem] uppercase tracking-widest text-signal transition-colors hover:bg-signal/25 disabled:opacity-40">add</button>
        </div>
        {err && <div className="mt-2 font-mono text-[0.72rem] text-[#ff5a5a]">{err}</div>}

        {/* model picker for the connected provider */}
        {provider && !free && (
          <div className="mt-3">
            <div className="mb-1.5 font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground/60">model</div>
            <div className="flex flex-wrap gap-1.5">
              {MODELS[provider].map((mi) => (
                <button key={mi.id} onClick={() => pickModel(mi.id)}
                  className={`rounded-lg border px-2.5 py-1 font-mono text-[0.7rem] transition-colors ${model === mi.id ? "border-signal/50 bg-signal/10 text-signal" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {mi.label}{mi.free ? " · free" : ""}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={onClose} className="mt-5 w-full rounded-xl border border-signal/50 bg-signal/10 px-4 py-2.5 font-mono text-[0.74rem] uppercase tracking-widest text-signal transition-colors hover:bg-signal/20">Done</button>
      </div>
    </div>
  );
}
