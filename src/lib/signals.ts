// The signal desk. Real technical reads on the tokenized-stock universe the fund
// trades — momentum, trend and RSI computed from real daily prices (Yahoo, no key).
// This is the fund's edge, exposed: not "buy a token", but a live view of the
// 24/7 on-chain stock market that agents can act on.

export type Stance = "Accumulate" | "Hold" | "Trim";

export type Signal = {
  symbol: string;
  name: string;
  price: number;
  changePct: number; // 1-day %
  rsi: number; // 0..100
  momentum: number; // 20-day rate-of-change %
  trend: "up" | "down" | "flat";
  stance: Stance;
  spark: number[]; // last ~30 closes for a sparkline
};

// the fund's own universe — exactly what it holds + the Magnificent Seven it DCAs.
// these reads are the signals behind the fund's positions, not a generic screener.
const UNIVERSE: { symbol: string; name: string }[] = [
  { symbol: "NVDA", name: "Nvidia" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "META", name: "Meta" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "PLTR", name: "Palantir" },
  { symbol: "MU", name: "Micron" },
  { symbol: "QQQ", name: "Invesco QQQ" },
];

async function fetchCloses(symbol: string): Promise<number[]> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 600 } },
    );
    if (!r.ok) return [];
    const j = (await r.json()) as any;
    const q = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return (q as (number | null)[]).filter((x): x is number => typeof x === "number");
  } catch {
    return [];
  }
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gain = 0, loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  const avgG = gain / period, avgL = loss / period;
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

function sma(closes: number[], n: number): number {
  if (closes.length < n) return closes.reduce((a, b) => a + b, 0) / closes.length;
  const s = closes.slice(-n);
  return s.reduce((a, b) => a + b, 0) / n;
}

function stanceOf(price: number, sma50: number, mom: number, r: number): Stance {
  if (r >= 70) return "Trim";
  if (price > sma50 && mom > 1.5 && r < 68) return "Accumulate";
  if (price < sma50 && mom < -1.5) return "Trim";
  return "Hold";
}

function toSignal(symbol: string, name: string, closes: number[]): Signal | null {
  if (closes.length < 20) return null;
  const price = closes[closes.length - 1];
  const prev = closes[closes.length - 2] ?? price;
  const changePct = prev ? ((price - prev) / prev) * 100 : 0;
  const sma50 = sma(closes, 50);
  const r = rsi(closes, 14);
  const base = closes[Math.max(0, closes.length - 21)];
  const momentum = base ? ((price - base) / base) * 100 : 0;
  const trend = price > sma50 * 1.005 ? "up" : price < sma50 * 0.995 ? "down" : "flat";
  return {
    symbol,
    name,
    price,
    changePct,
    rsi: Math.round(r),
    momentum,
    trend,
    stance: stanceOf(price, sma50, momentum, r),
    spark: closes.slice(-30),
  };
}

/** The fund's live signal desk — real reads across the tokenized-stock universe. */
export async function getSignals(): Promise<Signal[]> {
  const rows = await Promise.all(
    UNIVERSE.map(async (u) => toSignal(u.symbol, u.name, await fetchCloses(u.symbol))),
  );
  return rows
    .filter((s): s is Signal => s !== null)
    // strongest conviction first: accumulate, then by momentum
    .sort((a, b) => {
      const rank = (s: Signal) => (s.stance === "Accumulate" ? 0 : s.stance === "Trim" ? 2 : 1);
      return rank(a) - rank(b) || b.momentum - a.momentum;
    });
}
