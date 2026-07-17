"use client";

import type { Icon } from "@tabler/icons-react";
import { SKILLS, SKILL_GROUPS, skillById, type Skill } from "./skills";

// Any command-menu row (a Skill or a Source) — structural shape the menu renders.
type MenuItem = { id: string; command: string; label: string; desc: string; icon: Icon; arg?: string; logo?: string };

// A row's glyph — a brand logo when the item has one, else its icon.
function Glyph({ item, size = 16 }: { item: MenuItem; size?: number }) {
  if (item.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.logo} alt="" width={size} height={size} className="rounded-[3px] object-contain" style={{ width: size, height: size }} />;
  }
  const I = item.icon;
  return <I size={size} />;
}

// ── the "/" command bar in the composer ──
// Show the menu while the user is typing the command token (no space yet).
export function slashQuery(input: string): string | null {
  return /^\/\w*$/.test(input) ? input : null;
}
export function matchSlash(input: string): Skill[] {
  const q = slashQuery(input);
  if (q == null) return [];
  const term = q.slice(1).toLowerCase();
  return SKILLS.filter((s) => s.command.slice(1).startsWith(term) || s.label.toLowerCase().includes(term));
}
// Resolve a sent message like "/news NVDA" → the skill + its argument.
export function resolveSlashCommand(text: string): { skill: Skill; arg: string } | null {
  const m = text.match(/^(\/\w+)(?:\s+([\s\S]*))?$/);
  if (!m) return null;
  const skill = SKILLS.find((s) => s.command === m[1].toLowerCase());
  return skill ? { skill, arg: (m[2] ?? "").trim() } : null;
}

export function SlashMenu<T extends MenuItem>({ items, active, onPick, title = "Skills" }: { items: T[]; active: number; onPick: (s: T) => void; title?: string }) {
  if (!items.length) return null;
  return (
    <div className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-xl border border-border bg-[#0d0d0f] shadow-2xl">
      <div className="border-b border-border px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="max-h-[280px] overflow-y-auto p-1">
        {items.map((s, i) => (
          <button key={s.id} onMouseDown={(e) => { e.preventDefault(); onPick(s); }}
            className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${i === active ? "bg-signal/10" : "hover:bg-white/[0.04]"}`}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border ${i === active ? "border-signal/50 text-signal" : "border-border text-muted-foreground"}`}><Glyph item={s} size={16} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2"><span className="font-mono text-[12px] text-foreground">{s.command}</span>{s.arg && <span className="font-mono text-[10px] text-muted-foreground">{s.arg}</span>}</div>
              <div className="truncate text-[11px] text-muted-foreground">{s.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── the Skills tab: choose which skills the agent may call ──
export function SkillsModal({ enabled, onToggle, onSet, onClose }: {
  enabled: string[]; onToggle: (id: string) => void; onSet: (ids: string[]) => void; onClose: () => void;
}) {
  const on = (id: string) => enabled.includes(id);
  const allIds = SKILLS.map((s) => s.id);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="skill-in flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-[#0b0b0d] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <div className="text-[15px] font-semibold">Agent skills</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{enabled.length} of {allIds.length} on · type / to launch one</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="flex items-center gap-3 border-b border-border px-5 py-2">
          <button onClick={() => onSet(allIds)} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-signal">All on</button>
          <span className="text-border">·</span>
          <button onClick={() => onSet([])} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-signal">All off</button>
        </div>

        <div className="grid gap-5 overflow-y-auto p-5">
          {SKILL_GROUPS.map((g) => (
            <div key={g} className="grid gap-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-signal">{g}</div>
              {SKILLS.filter((s) => s.group === g).map((s) => (
                <button key={s.id} onClick={() => onToggle(s.id)} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-signal/30">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border ${on(s.id) ? "border-signal/50 bg-signal/10 text-signal" : "border-border text-muted-foreground"}`}><s.icon size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="text-[13px] font-medium text-foreground">{s.label}</span><span className="font-mono text-[10px] text-muted-foreground">{s.command}</span></div>
                    <div className="truncate text-[11px] text-muted-foreground">{s.desc}</div>
                  </div>
                  <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on(s.id) ? "bg-signal" : "bg-white/10"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-black transition-transform ${on(s.id) ? "translate-x-4" : "translate-x-0.5"}`} />
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { skillById };
