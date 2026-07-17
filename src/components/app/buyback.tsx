"use client";

import { useEffect, useState } from "react";

/** Next weekly buyback = upcoming Friday 20:00 UTC. */
function nextBuyback(now: number): number {
  const d = new Date(now);
  const day = d.getUTCDay();
  let add = (5 - day + 7) % 7;
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 20, 0, 0));
  if (add === 0 && now >= target.getTime()) add = 7;
  target.setUTCDate(target.getUTCDate() + add);
  return target.getTime();
}

const CADENCE_MS = 7 * 24 * 3600 * 1000;

const STEPS = [
  { k: "Accrue", d: "Fees and realized P&L pool in the fund's wallet." },
  { k: "Schedule", d: "The weekly window opens every Friday." },
  { k: "Buy back", d: "A share of the pool market-buys $URI." },
  { k: "Accrue to holders", d: "Supply tightens — value flows to $URI." },
];

export function Buyback() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = now ? nextBuyback(now) : 0;
  const remain = now ? Math.max(0, target - now) : 0;
  const progress = now ? 1 - Math.min(1, remain / CADENCE_MS) : 0;
  const d = Math.floor(remain / 86400000);
  const h = Math.floor((remain % 86400000) / 3600000);
  const m = Math.floor((remain % 3600000) / 60000);

  const R = 54, C = 2 * Math.PI * R;

  return (
    <div className="rounded-[4px] border border-white/[0.08] bg-white/[0.015] p-6 backdrop-blur-xl">
      <h3 className="mb-6 font-display text-2xl text-foreground">Buyback engine</h3>

      <div className="flex flex-col items-center gap-7 sm:flex-row">
        <div className="relative grid shrink-0 place-items-center">
          <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
            <circle cx="66" cy="66" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
            <circle
              cx="66" cy="66" r={R} fill="none" stroke="#34F003" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
              style={{ transition: "stroke-dashoffset 1s linear", filter: "drop-shadow(0 0 5px rgba(52,240,3,0.5))" }}
            />
          </svg>
          <div className="absolute text-center">
            <div className="font-display text-2xl tabular-nums text-foreground">
              {now ? `${d}d ${String(h).padStart(2, "0")}h` : "—"}
            </div>
            <div className="text-sm text-muted-foreground">{now ? `${m}m to next` : ""}</div>
          </div>
        </div>

        <ol className="flex-1 space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.k} className="flex gap-3.5">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-signal/40 text-sm text-signal">
                {i + 1}
              </span>
              <div>
                <div className="font-display text-base text-foreground">{step.k}</div>
                <div className="text-sm text-muted-foreground">{step.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
