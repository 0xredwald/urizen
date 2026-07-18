"use client";

// The agent's live activity — a shimmering status with a pulsing glyph that reflects the tool
// in flight (searching, charting, screening, comparing, building). Replaces the bare blinking dot.

const GLYPH: [RegExp, string][] = [
  [/search|web/i, "◍"],
  [/tape|tick|news|headline/i, "▤"],
  [/draw|trend|line|level|support|resist/i, "╱"],
  [/mark|annot/i, "◉"],
  [/indicator|add|ma\b|rsi|macd/i, "∿"],
  [/panel|open/i, "▦"],
  [/chart/i, "◈"],
  [/read/i, "▤"],
  [/screen/i, "⋔"],
  [/compar/i, "⇌"],
  [/strateg|build/i, "◆"],
  [/swap|trade|buy|sell|prepar/i, "◈"],
];
function glyphFor(s: string) {
  for (const [re, g] of GLYPH) if (re.test(s)) return g;
  return "✳";
}

export function Thinking({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <span className="relative grid h-5 w-5 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-signal/25" />
        <span className="text-[13px] text-signal">{glyphFor(status)}</span>
      </span>
      <span className="shimmer-text font-mono text-[13px] tracking-wide">{status}</span>
    </div>
  );
}
