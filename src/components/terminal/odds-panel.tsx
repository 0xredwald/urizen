"use client";

// Live prediction-market odds — real-money probabilities from Polymarket, always on. The market's
// own view of what happens next (Fed cuts, elections, crypto, macro), sitting right next to the tape.
// Refreshes on a slow loop because odds move slowly; each row links out to the live market.

import { useEffect, useRef, useState } from "react";

type Odd = { question: string; probability: number; outcome: string; volumeUsd: number | null; url: string };

const compactUsd = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`;

export function OddsPanel() {
  const [odds, setOdds] = useState<Odd[] | null>(null);
  const [err, setErr] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    let on = true;
    const load = () => fetch("/api/quant/predictions")
      .then((r) => r.json())
      .then((d) => { if (!on) return; if (Array.isArray(d?.markets)) { setOdds(d.markets); setErr(false); } else setErr(true); })
      .catch(() => { if (on) setErr(true); })
      .finally(() => { first.current = false; });
    load();
    const id = setInterval(load, 120000);
    return () => { on = false; clearInterval(id); };
  }, []);

  if (odds === null && !err) {
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-2.5 w-3/4 rounded bg-white/[0.05]" />
            <div className="h-2 w-full rounded bg-white/[0.03]" />
          </div>
        ))}
      </div>
    );
  }
  if (err || !odds?.length) {
    return <div className="grid h-full place-items-center p-4 text-center font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground/50">odds unavailable</div>;
  }

  return (
    <div className="divide-y divide-border/40">
      {odds.map((o, i) => {
        const pct = Math.round(o.probability * 100);
        const hot = pct >= 65 || pct <= 35; // decisive markets
        return (
          <a key={i} href={o.url} target="_blank" rel="noopener noreferrer"
            className="group block px-3 py-2 transition-colors hover:bg-white/[0.03]">
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <span className="line-clamp-2 text-[0.74rem] leading-snug text-foreground/85 group-hover:text-foreground">{o.question}</span>
              <span className={`shrink-0 font-mono text-[0.82rem] font-semibold tabular-nums ${hot ? "text-signal" : "text-foreground/80"}`}>{pct}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="absolute inset-y-0 left-0 rounded-full bg-signal/80" style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
              </div>
              <span className="shrink-0 font-mono text-[0.56rem] uppercase tracking-wide text-muted-foreground">{o.outcome}</span>
              {o.volumeUsd ? <span className="shrink-0 font-mono text-[0.56rem] tabular-nums text-muted-foreground/60">{compactUsd(o.volumeUsd)}</span> : null}
            </div>
          </a>
        );
      })}
    </div>
  );
}
