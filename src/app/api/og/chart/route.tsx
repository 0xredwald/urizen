import { ImageResponse } from "next/og";

// Branded Urizen price chart, rendered server-side (no key). Fetches real OHLC, draws a clean neon
// area chart with the Urizen mark and price header. Replaces the ugly QuickChart output in the bot.
// Query: ?symbol=NVDA&range=1m  (range passes through to /api/quant/ohlc)
export const runtime = "edge";

const SIGNAL = "#34F003";
const RED = "#ff5c5c";
const MARK = "https://urizenfund.com/img/mark-green.png";

function chartSvg(closes: number[], up: boolean): string {
  const W = 1080, H = 380, PAD = 8;
  const lo = Math.min(...closes), hi = Math.max(...closes);
  const span = hi - lo || 1;
  const col = up ? SIGNAL : RED;
  const pt = (v: number, i: number) => [(i / (closes.length - 1)) * W, PAD + (1 - (v - lo) / span) * (H - PAD * 2)];
  const xy = closes.map(pt);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const grid = [0.25, 0.5, 0.75].map((f) => `<line x1="0" y1="${(H * f).toFixed(0)}" x2="${W}" y2="${(H * f).toFixed(0)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`).join("");
  const [lx, ly] = xy[xy.length - 1];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="0.34"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>` +
    grid +
    `<path d="${area}" fill="url(#g)"/>` +
    `<path d="${line}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="7" fill="${col}"/>` +
    `</svg>`
  );
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const symbol = (u.searchParams.get("symbol") || "NVDA").replace(/^\$/, "").toUpperCase();
  const range = u.searchParams.get("range") || "1m";

  let closes: number[] = [];
  let price = 0;
  const currency = "$";
  try {
    const r = await fetch(`https://urizenfund.com/api/quant/ohlc?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`);
    const d = await r.json();
    closes = (d?.candles || []).map((c: { c: number }) => c.c).filter((n: number) => Number.isFinite(n));
    price = Number(d?.price) || closes[closes.length - 1] || 0;
  } catch { /* render an empty-state card */ }

  // color + % follow the drawn range (first → last close) so the header matches the line
  const rangeStart = closes[0] || price;
  const up = price >= rangeStart;
  const col = up ? SIGNAL : RED;
  const chg = rangeStart ? ((price - rangeStart) / rangeStart) * 100 : 0;
  const svgUri = closes.length >= 2 ? `data:image/svg+xml;base64,${btoa(chartSvg(closes, up))}` : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: `radial-gradient(70% 90% at 82% 8%, ${up ? "rgba(52,240,3,0.14)" : "rgba(255,92,92,0.12)"} 0%, transparent 55%), #060706`, padding: "50px 58px 44px", fontFamily: "monospace" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MARK} width={42} height={42} alt="" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 46, fontWeight: 700, color: "#f4f3ee", lineHeight: 1 }}>{`$${symbol}`}</div>
              <div style={{ fontSize: 15, letterSpacing: 4, color: "rgba(244,243,238,0.45)" }}>{`URIZEN · ${range.toUpperCase()}`}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: 52, fontWeight: 700, color: "#f4f3ee", lineHeight: 1 }}>{`${currency}${price >= 1 ? price.toFixed(2) : price.toPrecision(3)}`}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: col }}>{`${chg >= 0 ? "▲ +" : "▼ "}${chg.toFixed(2)}%`}</div>
          </div>
        </div>

        {/* chart */}
        {svgUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={svgUri} width={1084} height={382} alt="" style={{ marginTop: 8 }} />
        ) : (
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: "rgba(244,243,238,0.4)", fontSize: 24 }}>no price data</div>
        )}

        {/* footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ width: 90, height: 3, display: "flex", background: col }} />
          <div style={{ fontSize: 18, letterSpacing: 2, color: "rgba(244,243,238,0.55)" }}>urizenfund.com</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
