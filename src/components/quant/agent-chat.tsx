"use client";

import { useEffect, useRef, useState } from "react";
import { chatTurn, type ChatMsg } from "@/lib/agent-chat";
import type { Agent, KeyBinding } from "@/lib/agents";
import type { AgentConfig } from "@/lib/agent-graph";
import type { Indicators } from "@/lib/quant";

const SUGGESTIONS = [
  "What do the numbers say right now?",
  "Be more aggressive on dips",
  "Add a stop if RSI runs above 78",
  "Rotate into the strongest name only",
];

export function AgentChat({
  agent, binding, indicators, config, onConfig, onFocus, onSwap,
}: {
  agent: Agent;
  binding: KeyBinding | null;
  indicators: Indicators[];
  config: AgentConfig;
  onConfig: (c: AgentConfig) => void;
  onFocus: (sym: string) => void;
  onSwap?: (p: import("@/lib/rialto").SwapProposal) => void;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMsgs([]); setErr(null); }, [agent.id]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }); }, [msgs, busy]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    if (!binding) { setErr("Bind an intelligence key to talk to your agent."); return; }
    setErr(null);
    const history = msgs;
    setMsgs((m) => [...m, { role: "user", content: t }]);
    setInput("");
    setBusy(true);
    try {
      const r = await chatTurn(agent, binding, history, t, indicators, config);
      setMsgs((m) => [...m, { role: "assistant", content: r.reply, config: r.config, swap: r.swap }]);
      if (r.config) onConfig(r.config);
      if (r.chartFocus && agent.instruments.includes(r.chartFocus)) onFocus(r.chartFocus);
      if (r.swap) onSwap?.(r.swap);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-[420px] flex-col border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Talk to {agent.name}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{binding ? binding.provider : "no key"}</span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {msgs.length === 0 && (
          <div className="grid gap-3 pt-2">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Prompt your agent. It reasons over the live indicators and rewrites its own workflow when you
              tell it how you want it to trade.
            </p>
            <div className="grid gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="justify-self-start border border-border bg-background px-2.5 py-1.5 text-left font-mono text-[11px] text-muted-foreground transition-colors hover:border-signal/40 hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] whitespace-pre-wrap px-3 py-2 text-[13px] leading-relaxed ${
              m.role === "user" ? "border border-signal/30 bg-signal/10 text-foreground" : "border border-border bg-background text-foreground/90"
            }`}>
              {m.content}
              {m.config && (
                <div className="mt-1.5 border-t border-signal/20 pt-1.5 font-mono text-[10px] uppercase tracking-widest text-signal">
                  ⟳ workflow updated
                </div>
              )}
              {m.swap && (
                <div className="mt-1.5 border-t border-signal/20 pt-1.5 font-mono text-[10px] uppercase tracking-widest text-signal">
                  ◈ proposed swap · {m.swap.sellAmount} {m.swap.sellSym} → {m.swap.buySym} · review in Trade →
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="border border-border bg-background px-3 py-2 font-mono text-[11px] text-muted-foreground">reasoning<span className="animate-pulse">…</span></div></div>}
      </div>

      {err && <div className="border-t border-[#ff5c5c]/30 bg-[#ff5c5c]/5 px-4 py-2 font-mono text-[11px] text-[#ff5c5c]">{err}</div>}

      <div className="flex gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder={binding ? "tell your agent what to do…" : "bind a key first"}
          disabled={busy}
          className="flex-1 border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-signal/60 focus:outline-none disabled:opacity-50"
        />
        <button onClick={() => send(input)} disabled={busy || !input.trim()} className="border border-signal/60 bg-signal/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-signal transition-colors hover:bg-signal/20 disabled:opacity-40">
          send
        </button>
      </div>
    </div>
  );
}
