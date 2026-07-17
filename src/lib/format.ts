export function usd(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function compact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
}

export function pct(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

/** Smart price formatter for tiny token prices, e.g. $0.0₆225 style fallback. */
export function price(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  // count leading zeros after the decimal point
  const s = n.toFixed(20);
  const m = s.match(/^0\.(0*)(\d{1,4})/);
  if (!m) return `$${n.toExponential(2)}`;
  const zeros = m[1].length;
  return `$0.0${toSub(zeros)}${m[2]}`;
}
const SUBS = "₀₁₂₃₄₅₆₇₈₉";
const toSub = (n: number) => String(n).split("").map((d) => SUBS[+d]).join("");

export function shortAddr(a: string): string {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
