"use client";

import { useState } from "react";
import { StockLogo } from "@/components/brand/stock-logo";
import { UrizenMark } from "@/components/brand/marks";
import { STOCKS } from "@/lib/stocks";
import { newId, type Agent, type Mandate, type Risk } from "@/lib/agents";

const MANDATES: Mandate[] = ["Momentum", "DCA", "Rotation", "Yield", "Hedge"];
const RISKS: Risk[] = ["conservative", "balanced", "aggressive"];

export function NewAgentModal({ onClose, onCreate }: { onClose: () => void; onCreate: (a: Agent) => void }) {
  const [name, setName] = useState("");
  const [mandate, setMandate] = useState<Mandate>("Momentum");
  const [risk, setRisk] = useState<Risk>("balanced");
  const [instruments, setInstruments] = useState<string[]>(["NVDA", "AAPL", "MSFT"]);
  const [note, setNote] = useState("");
  const [seed] = useState(() => newId());

  const toggle = (s: string) => setInstruments((p) => (p.includes(s) ? p.filter((x) => x !== s) : p.length < 8 ? [...p, s] : p));
  const canCreate = name.trim().length > 1 && instruments.length >= 1;

  const create = () => {
    if (!canCreate) return;
    onCreate({ id: seed, name: name.trim(), mandate, risk, instruments, note: note.trim() || undefined, createdAt: Date.now() });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">New agent</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="grid gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-signal/30 bg-signal/[0.07]"><UrizenMark className="h-7 w-auto text-signal" /></span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name your agent — e.g. Alpha Scout"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:border-signal/60 focus:outline-none" />
          </div>

          <div className="grid gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Mandate</span>
            <div className="flex flex-wrap gap-1.5">
              {MANDATES.map((m) => (
                <button key={m} onClick={() => setMandate(m)} className={`rounded-md border px-3 py-1.5 text-[12px] transition-colors ${mandate === m ? "border-signal/70 bg-signal/10 text-foreground" : "border-border text-muted-foreground hover:border-signal/30"}`}>{m}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Watchlist</span>
            <div className="flex flex-wrap gap-1.5">
              {STOCKS.map((s) => {
                const on = instruments.includes(s.symbol);
                return (
                  <button key={s.symbol} onClick={() => toggle(s.symbol)} className={`flex items-center gap-1.5 rounded-md border py-1 pl-1 pr-2 transition-colors ${on ? "border-signal/70 bg-signal/10" : "border-border hover:border-signal/30"}`}>
                    <StockLogo symbol={s.symbol} size={16} /><span className="font-mono text-[11px]">{s.symbol}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Risk</span>
              <div className="flex gap-1.5">
                {RISKS.map((r) => <button key={r} onClick={() => setRisk(r)} className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] capitalize transition-colors ${risk === r ? "border-signal/70 bg-signal/10 text-foreground" : "border-border text-muted-foreground hover:border-signal/30"}`}>{r}</button>)}
              </div>
            </div>
            <label className="grid gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Directive (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. focus on AI infra"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-signal/60 focus:outline-none" />
            </label>
          </div>

          <button onClick={create} disabled={!canCreate} className="rounded-md border border-signal/60 bg-signal/10 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-signal transition-colors hover:bg-signal/20 disabled:cursor-not-allowed disabled:opacity-40">
            Create agent
          </button>
        </div>
      </div>
    </div>
  );
}
