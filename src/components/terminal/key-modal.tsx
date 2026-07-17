"use client";

import { useEffect, useState } from "react";
// import the Mono glyph variant directly — the icon barrels + Avatar/Combine variants pull a heavy
// @lobehub/ui dep we don't want; Mono is a clean react-only SVG (inherits currentColor).
import OpenRouter from "@lobehub/icons/es/OpenRouter/components/Mono";
import Claude from "@lobehub/icons/es/Claude/components/Mono";
import OpenAI from "@lobehub/icons/es/OpenAI/components/Mono";
import Grok from "@lobehub/icons/es/Grok/components/Mono";
import Gemini from "@lobehub/icons/es/Gemini/components/Mono";
import DeepSeek from "@lobehub/icons/es/DeepSeek/components/Mono";
import Meta from "@lobehub/icons/es/Meta/components/Mono";
import Mistral from "@lobehub/icons/es/Mistral/components/Mono";
import Qwen from "@lobehub/icons/es/Qwen/components/Mono";
import Groq from "@lobehub/icons/es/Groq/components/Mono";
import { addProviderKey, listProviderKeys, removeProviderKey, setModel, getActiveModel, isFreeMode, MODELS, getActiveProvider, type Provider } from "@/lib/agents";

// brand string (from agents.ts MODELS) → the official provider logo
const BRAND_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  openrouter: OpenRouter, anthropic: Claude, openai: OpenAI, xai: Grok, google: Gemini,
  deepseek: DeepSeek, meta: Meta, mistral: Mistral, qwen: Qwen, groq: Groq,
};
function Brand({ brand, size = 15 }: { brand: string; size?: number }) {
  const I = BRAND_ICON[brand];
  return I ? <I size={size} /> : <span className="font-mono text-[0.7rem] text-muted-foreground">{brand.slice(0, 2)}</span>;
}
const PROVIDER_BRAND: Record<Provider, string> = { anthropic: "anthropic", openai: "openai", openrouter: "openrouter" };

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
        <div className="mt-3 flex flex-wrap items-center gap-3 text-foreground/85">
          {["openrouter", "anthropic", "openai", "xai", "google", "deepseek", "meta", "mistral", "qwen", "groq"].map((b) => (
            <span key={b} title={b} className="opacity-60 transition-opacity hover:opacity-100"><Brand brand={b} size={19} /></span>
          ))}
        </div>

        {/* current mode */}
        <div className="mt-4 rounded-xl border border-border bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            {!free && provider ? <Brand brand={PROVIDER_BRAND[provider]} size={15} /> : <span className="h-1.5 w-1.5 rounded-full bg-signal" />}
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
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[0.7rem] transition-colors ${model === mi.id ? "border-signal/50 bg-signal/10 text-signal" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  <Brand brand={mi.brand} size={13} />{mi.label}{mi.free ? " · free" : ""}
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

// A compact inline version for the agent rail — set up the key right there, no modal click.
export function InlineKeySetup({ onChanged, onMore }: { onChanged?: () => void; onMore?: () => void }) {
  const [keys, setKeys] = useState<{ provider: Provider; last4: string }[]>([]);
  const [free, setFree] = useState(true);
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => { setKeys(listProviderKeys()); setFree(isFreeMode()); };
  useEffect(() => { refresh(); }, []);
  const save = () => { const k = input.trim(); if (!k) return; try { addProviderKey(k); setInput(""); setErr(null); refresh(); onChanged?.(); } catch (e) { setErr((e as Error).message); } };
  return (
    <div className="rounded-xl border border-border bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-widest text-signal"><span className="h-1.5 w-1.5 rounded-full bg-signal" />{free ? "Free Mode" : `${keys[0]?.provider} connected`}</span>
        {onMore && <button onClick={onMore} className="font-mono text-[0.58rem] uppercase tracking-widest text-muted-foreground hover:text-signal">manage</button>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2.5 text-foreground/70">
        {["openrouter", "anthropic", "openai", "xai", "google", "deepseek", "meta", "mistral", "qwen", "groq"].map((b) => <span key={b} title={b} className="opacity-55 transition-opacity hover:opacity-100"><Brand brand={b} size={16} /></span>)}
      </div>
      <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-border bg-[#0d0d10] p-1 focus-within:border-signal/40">
        <input value={input} onChange={(e) => setInput(e.target.value)} type="password" placeholder="paste a key for the top models…" className="min-w-0 flex-1 bg-transparent px-2 py-1 font-mono text-[0.76rem] outline-none placeholder:text-muted-foreground/50" />
        <button onClick={save} disabled={!input.trim()} className="rounded-md bg-signal/15 px-2.5 py-1 font-mono text-[0.66rem] uppercase tracking-widest text-signal transition-colors hover:bg-signal/25 disabled:opacity-40">add</button>
      </div>
      {err && <div className="mt-1.5 font-mono text-[0.68rem] text-[#ff5a5a]">{err}</div>}
      <div className="mt-1.5 text-[0.7rem] leading-snug text-muted-foreground">encrypted in your browser, sent only to the provider — or just keep Free Mode.</div>
    </div>
  );
}
