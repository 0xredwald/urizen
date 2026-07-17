"use client";

import { useEffect, useRef, useState } from "react";
import { UrizenMark } from "@/components/brand/marks";
import { ModelLogo } from "@/components/alpha/provider-logos";
import { MODELS, getActiveBinding, getActiveModel, setModel, isFreeMode, type Provider, type ModelInfo } from "@/lib/agents";

// Model selector popup. Shows the active provider's models with their real brand logos (Grok, Gemini,
// DeepSeek, Llama…). In Free Mode the free models are selectable and the frontier roster is shown as a
// locked showcase, so you can see everything and add a key to unlock it.
export function ModelPicker({ onChange }: { onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [free, setFree] = useState(false);
  const [provider, setProvider] = useState<Provider>("openrouter");
  const [current, setCurrent] = useState<string | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = () => {
    const b = getActiveBinding();
    setFree(isFreeMode());
    setProvider(b?.provider ?? "openrouter");
    setCurrent(getActiveModel() ?? b?.model);
  };
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const all = MODELS[provider];
  const activeList = free ? all.filter((m) => m.free) : all;
  const active = activeList.find((m) => m.id === current) ?? activeList[0];
  const pick = (id: string) => { setModel(id); setCurrent(id); setOpen(false); onChange(); };

  const Row = ({ m, locked }: { m: ModelInfo; locked?: boolean }) => {
    const on = !locked && m.id === active?.id;
    return (
      <button
        onClick={() => !locked && pick(m.id)}
        disabled={locked}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${on ? "bg-signal/10" : locked ? "opacity-45" : "hover:bg-white/[0.05]"}`}
      >
        <ModelLogo brand={m.brand} size={18} />
        <span className="flex-1 truncate text-[13px] text-foreground">{m.label}</span>
        {m.free && <span className="rounded-full bg-signal/15 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-signal">free</span>}
        {locked ? <span className="text-[11px] text-muted-foreground">🔒</span> : on ? <span className="text-[11px] text-signal">✓</span> : null}
      </button>
    );
  };

  const buttonMark = free
    ? <span className="grid place-items-center rounded-[3px] bg-signal/15" style={{ width: 15, height: 15 }}><UrizenMark className="h-2/3 w-auto text-signal" /></span>
    : <ModelLogo brand={active?.brand ?? provider} size={15} />;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12px] transition-colors hover:border-signal/40">
        {buttonMark}
        <span className="font-medium text-foreground">{active?.label ?? "Model"}</span>
        {free && <span className="rounded-full bg-signal/15 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-signal">free</span>}
        <span className="text-[9px] text-muted-foreground">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-border bg-[#0e0e11] p-1.5 shadow-2xl">
          {free ? (
            <>
              <div className="px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Free · Urizen mode</div>
              {all.filter((m) => m.free).map((m) => <Row key={m.id} m={m} />)}
              <div className="mt-1 border-t border-border px-2.5 pb-1 pt-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Frontier · add a key to run</div>
              {all.filter((m) => !m.free).map((m) => <Row key={m.id} m={m} locked />)}
              <div className="mt-1 border-t border-border px-2.5 pt-2 font-mono text-[9px] leading-relaxed text-muted-foreground">Add an OpenRouter, Anthropic or OpenAI key (sidebar) to unlock Grok, Gemini, Claude, GPT &amp; more.</div>
            </>
          ) : (
            <>
              <div className="px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Select a model</div>
              {all.map((m) => <Row key={m.id} m={m} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
