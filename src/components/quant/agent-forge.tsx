"use client";

import { useState } from "react";
import { StockLogo } from "@/components/brand/stock-logo";
import { STOCKS } from "@/lib/stocks";
import { newId, type Agent, type Mandate, type Risk } from "@/lib/agents";

const MANDATES: { id: Mandate; label: string; glyph: string; blurb: string }[] = [
  { id: "DCA", label: "Accumulate", glyph: "⊞", blurb: "Programmatic DCA into the chosen names, vol-weighted." },
  { id: "Momentum", label: "Momentum", glyph: "⇗", blurb: "Ride trend while price holds above its measure." },
  { id: "Rotation", label: "Rotation", glyph: "⟳", blurb: "Rotate the sleeve toward the strongest instruments." },
  { id: "Yield", label: "Yield", glyph: "⊚", blurb: "Park in treasuries; deploy on drawdown." },
  { id: "Hedge", label: "Hedge", glyph: "⊗", blurb: "Trim into euphoria, cover into fear." },
];

const RISKS: { id: Risk; label: string }[] = [
  { id: "conservative", label: "Conservative" },
  { id: "balanced", label: "Balanced" },
  { id: "aggressive", label: "Aggressive" },
];

export function AgentForge({ owner, onCreate }: { owner?: string; onCreate: (a: Agent) => void }) {
  const [name, setName] = useState("");
  const [mandate, setMandate] = useState<Mandate>("Momentum");
  const [risk, setRisk] = useState<Risk>("balanced");
  const [instruments, setInstruments] = useState<string[]>(["NVDA", "AAPL", "MSFT"]);
  const [note, setNote] = useState("");

  const toggle = (sym: string) =>
    setInstruments((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : prev.length < 8 ? [...prev, sym] : prev,
    );

  const canForge = name.trim().length > 1 && instruments.length >= 1;

  const forge = () => {
    if (!canForge) return;
    onCreate({
      id: newId(),
      name: name.trim(),
      mandate,
      instruments,
      risk,
      note: note.trim() || undefined,
      createdAt: Date.now(),
      owner,
    });
    setName(""); setNote("");
  };

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Forge an agent</span>
        <span className="font-mono text-[10px] text-muted-foreground">{instruments.length}/8 instruments</span>
      </div>

      <div className="grid gap-5 p-4 md:p-5">
        {/* name */}
        <label className="grid gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Megacap Sentinel"
            className="border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-signal/60 focus:outline-none"
          />
        </label>

        {/* mandate */}
        <div className="grid gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Mandate</span>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
            {MANDATES.map((m) => {
              const on = mandate === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMandate(m.id)}
                  title={m.blurb}
                  className={`group flex flex-col items-start gap-1 border px-2.5 py-2 text-left transition-colors ${
                    on ? "border-signal/70 bg-signal/10" : "border-border bg-background hover:border-signal/30"
                  }`}
                >
                  <span className={`text-base leading-none ${on ? "text-signal" : "text-foreground"}`}>{m.glyph}</span>
                  <span className="text-[11px] font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {MANDATES.find((m) => m.id === mandate)?.blurb}
          </span>
        </div>

        {/* instruments */}
        <div className="grid gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Instruments</span>
          <div className="flex flex-wrap gap-1.5">
            {STOCKS.map((s) => {
              const on = instruments.includes(s.symbol);
              return (
                <button
                  key={s.symbol}
                  type="button"
                  onClick={() => toggle(s.symbol)}
                  className={`flex items-center gap-1.5 border py-1 pl-1 pr-2 transition-colors ${
                    on ? "border-signal/70 bg-signal/10" : "border-border bg-background hover:border-signal/30"
                  }`}
                >
                  <StockLogo symbol={s.symbol} size={18} />
                  <span className="font-mono text-[11px]">{s.symbol}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* risk + note */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Risk budget</span>
            <div className="flex gap-1.5">
              {RISKS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRisk(r.id)}
                  className={`flex-1 border px-2 py-2 text-[11px] transition-colors ${
                    risk === r.id ? "border-signal/70 bg-signal/10 text-foreground" : "border-border bg-background text-muted-foreground hover:border-signal/30"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <label className="grid gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Directive (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. favor AI infrastructure, avoid earnings weeks"
              className="border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-signal/60 focus:outline-none"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={forge}
          disabled={!canForge}
          className="group relative overflow-hidden border border-signal/60 bg-signal/10 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-signal transition-colors hover:bg-signal/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-background disabled:text-muted-foreground/50"
        >
          Forge agent ⟶
        </button>
      </div>
    </div>
  );
}
