"use client";

import { StockLogo } from "@/components/brand/stock-logo";
import { STOCKS } from "@/lib/stocks";
import type { AgentConfig, Condition, Action, IndicatorKey, Op, TriggerKind, ActionKind } from "@/lib/agent-graph";
import type { BlockKind } from "@/components/quant/config-graph";

const INDICATORS: IndicatorKey[] = ["RSI", "SMA20", "SMA50", "price", "trend", "vol", "return3m", "sharpe"];
const OPS: Op[] = [">", "<", ">=", "<=", "crosses_above", "crosses_below"];
const TRIGGERS: TriggerKind[] = ["interval", "price", "indicator", "session"];
const ACTIONS: ActionKind[] = ["buy", "sell", "reduce", "rotate", "hedge", "hold"];

const sel = "border border-input bg-background px-2 py-1 font-mono text-[11px] text-foreground focus:border-signal/60 focus:outline-none";
const lbl = "font-mono text-[9px] uppercase tracking-widest text-muted-foreground";

export function NodeConfig({
  block, config, onChange, onClose,
}: {
  block: BlockKind;
  config: AgentConfig;
  onChange: (c: AgentConfig) => void;
  onClose: () => void;
}) {
  const patch = (p: Partial<AgentConfig>) => onChange({ ...config, ...p });

  return (
    <div className="border border-signal/30 bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal">Configure · {block}</span>
        <button onClick={onClose} className="font-mono text-[11px] text-muted-foreground hover:text-foreground">✕</button>
      </div>
      <div className="grid gap-3 p-3">
        {block === "trigger" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1"><span className={lbl}>Kind</span>
              <select className={sel} value={config.trigger.kind} onChange={(e) => patch({ trigger: { ...config.trigger, kind: e.target.value as TriggerKind } })}>
                {TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            {(config.trigger.kind === "interval" || config.trigger.kind === "session") ? (
              <label className="grid gap-1"><span className={lbl}>Every</span>
                <input className={sel} value={config.trigger.every ?? ""} onChange={(e) => patch({ trigger: { ...config.trigger, every: e.target.value } })} placeholder="6h · 1d · market-open" />
              </label>
            ) : (
              <>
                <label className="grid gap-1"><span className={lbl}>Symbol</span>
                  <select className={sel} value={config.trigger.symbol ?? config.instruments[0]} onChange={(e) => patch({ trigger: { ...config.trigger, symbol: e.target.value } })}>
                    {config.instruments.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="grid gap-1"><span className={lbl}>Indicator</span>
                  <select className={sel} value={config.trigger.indicator ?? "RSI"} onChange={(e) => patch({ trigger: { ...config.trigger, indicator: e.target.value as IndicatorKey } })}>
                    {INDICATORS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </label>
                <label className="grid gap-1"><span className={lbl}>Op</span>
                  <select className={sel} value={config.trigger.op ?? ">"} onChange={(e) => patch({ trigger: { ...config.trigger, op: e.target.value as Op } })}>
                    {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
                <label className="grid gap-1"><span className={lbl}>Value</span>
                  <input className={sel} type="number" value={config.trigger.value ?? 30} onChange={(e) => patch({ trigger: { ...config.trigger, value: Number(e.target.value) } })} />
                </label>
              </>
            )}
          </div>
        )}

        {block === "conditions" && (
          <div className="grid gap-2">
            {config.conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <select className={sel} value={c.indicator} onChange={(e) => { const next = [...config.conditions]; next[i] = { ...c, indicator: e.target.value as IndicatorKey }; patch({ conditions: next }); }}>
                  {INDICATORS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <select className={sel} value={c.op} onChange={(e) => { const next = [...config.conditions]; next[i] = { ...c, op: e.target.value as Op }; patch({ conditions: next }); }}>
                  {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <input className={`${sel} w-20`} value={String(c.value)} onChange={(e) => { const next = [...config.conditions]; const v = e.target.value; next[i] = { ...c, value: isNaN(Number(v)) ? v : Number(v) }; patch({ conditions: next }); }} />
                <button className="px-1.5 font-mono text-[11px] text-muted-foreground hover:text-[#ff5c5c]" onClick={() => patch({ conditions: config.conditions.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="justify-self-start border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:border-signal/40 hover:text-signal"
              onClick={() => patch({ conditions: [...config.conditions, { indicator: "RSI", op: "<", value: 50 } as Condition] })}>+ condition</button>
          </div>
        )}

        {block === "actions" && (
          <div className="grid gap-2">
            {config.actions.map((a, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <select className={sel} value={a.kind} onChange={(e) => { const next = [...config.actions]; next[i] = { ...a, kind: e.target.value as ActionKind }; patch({ actions: next }); }}>
                  {ACTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <label className="flex items-center gap-1"><span className={lbl}>size</span>
                  <input className={`${sel} w-16`} type="number" value={a.sizePct ?? 20} onChange={(e) => { const next = [...config.actions]; next[i] = { ...a, sizePct: Number(e.target.value) }; patch({ actions: next }); }} />
                  <span className={lbl}>%</span>
                </label>
                <button className="px-1.5 font-mono text-[11px] text-muted-foreground hover:text-[#ff5c5c]" onClick={() => patch({ actions: config.actions.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="justify-self-start border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:border-signal/40 hover:text-signal"
              onClick={() => patch({ actions: [...config.actions, { kind: "buy", sizePct: 20 } as Action] })}>+ action</button>
          </div>
        )}

        {block === "instruments" && (
          <div className="flex flex-wrap gap-1.5">
            {STOCKS.map((s) => {
              const on = config.instruments.includes(s.symbol);
              return (
                <button key={s.symbol} onClick={() => patch({ instruments: on ? config.instruments.filter((x) => x !== s.symbol) : [...config.instruments, s.symbol] })}
                  className={`flex items-center gap-1.5 border py-1 pl-1 pr-2 transition-colors ${on ? "border-signal/70 bg-signal/10" : "border-border bg-background hover:border-signal/30"}`}>
                  <StockLogo symbol={s.symbol} size={16} />
                  <span className="font-mono text-[10px]">{s.symbol}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* sleeve is shared context, always shown */}
        <label className="grid gap-1 border-t border-border pt-3">
          <span className={lbl}>Sleeve · {config.sleevePct}% of book</span>
          <input type="range" min={1} max={100} value={config.sleevePct} onChange={(e) => patch({ sleevePct: Number(e.target.value) })} className="accent-signal" />
        </label>
      </div>
    </div>
  );
}
