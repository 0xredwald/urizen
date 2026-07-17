import { ImageResponse } from "next/og";

// Urizen trade-alert card for Telegram. William Blake's "Ancient of Days" (Urizen with the compass)
// as a darkened full-bleed background, the real Urizen mark, and the classified action. Server-side,
// no key. JPEG background (Satori can't decode webp).
// Params: kind (buy|sell|swap|lp-add|lp-remove|lp), token, token2, amount, usd, spark, logo.
export const runtime = "edge";

const SIGNAL = "#34F003"; // buy / swap / add — capital in
const RED = "#ff5c5c";    // sell — capital out
const LP = "#35c9f0";     // liquidity — neither a buy nor a sell
const BG = "https://urizenfund.com/img/blake-ancient.jpg";
const MARK = "https://urizenfund.com/img/mark-green.png";

type Kind = "buy" | "sell" | "swap" | "lp-add" | "lp-remove" | "lp";
const MAP: Record<Kind, { col: string; verb: string; pill: string }> = {
  buy: { col: SIGNAL, verb: "Urizen acquired", pill: "BUY" },
  sell: { col: RED, verb: "Urizen released", pill: "SELL" },
  swap: { col: SIGNAL, verb: "Urizen swapped into", pill: "SWAP" },
  "lp-add": { col: LP, verb: "Urizen added liquidity", pill: "LP +" },
  "lp-remove": { col: LP, verb: "Urizen pulled liquidity", pill: "LP −" },
  lp: { col: LP, verb: "Urizen rebalanced the pool", pill: "LP" },
};

function sparkDataUri(pts: number[], color: string): string | null {
  if (pts.length < 2) return null;
  const W = 560, H = 150;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * W, (1 - Math.max(0, Math.min(100, v)) / 100) * (H - 12) + 6]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>` +
    `<path d="${area}" fill="url(#g)"/>` +
    `<path d="${line}" fill="none" stroke="${color}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function GET(req: Request) {
  const u = new URL(req.url);
  const raw = (u.searchParams.get("kind") || u.searchParams.get("side") || "buy").toLowerCase();
  const kind: Kind = (["buy", "sell", "swap", "lp-add", "lp-remove", "lp"].includes(raw) ? raw : "buy") as Kind;
  const m = MAP[kind];
  const col = m.col;
  const token = (u.searchParams.get("token") || u.searchParams.get("symbol") || "URI").replace(/^\$/, "").toUpperCase();
  const token2 = (u.searchParams.get("token2") || "").replace(/^\$/, "").toUpperCase();
  const amount = u.searchParams.get("amount") || "";
  const usd = u.searchParams.get("usd") || "";
  const logo = u.searchParams.get("logo") || "";
  const isLp = kind === "lp-add" || kind === "lp-remove" || kind === "lp";
  const pair = token2 ? (kind === "swap" ? `from $${token2}` : `paired with $${token2}`) : "";
  const spark = (u.searchParams.get("spark") || "").split(",").map(Number).filter((n) => Number.isFinite(n));
  const sparkUri = sparkDataUri(spark, col);

  return new ImageResponse(
    (
      <div style={{ position: "relative", width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BG} width={1200} height={630} alt="" style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover", objectPosition: "center 18%" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, display: "flex", background: "linear-gradient(120deg, rgba(6,7,6,0.94) 0%, rgba(6,7,6,0.80) 46%, rgba(6,10,6,0.90) 100%)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, display: "flex", background: `radial-gradient(52% 70% at 88% 16%, ${col}30 0%, transparent 60%)` }} />

        <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "58px 62px", fontFamily: "monospace" }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MARK} width={44} height={44} alt="" />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: 7, color: "#f4f3ee" }}>URIZEN</div>
                <div style={{ fontSize: 13, letterSpacing: 5, color: "rgba(244,243,238,0.5)" }}>ROBINHOOD CHAIN</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", fontSize: 20, letterSpacing: 4, color: "#06070a", fontWeight: 700, background: col, borderRadius: 999, padding: "10px 24px" }}>
              {m.pill}
            </div>
          </div>

          {/* the action */}
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} width={96} height={96} alt="" style={{ borderRadius: 999, objectFit: "cover", border: `2px solid ${col}` }} />
            ) : null}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 28, letterSpacing: 1, color: "rgba(244,243,238,0.62)" }}>{m.verb}</div>
              <div style={{ fontSize: 88, fontWeight: 700, color: "#f4f3ee", lineHeight: 1 }}>{`$${token}`}</div>
              {pair ? <div style={{ fontSize: 24, color: col, marginTop: 4 }}>{pair}</div> : null}
            </div>
          </div>

          {/* amount + sparkline */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 34, color: "#f4f3ee" }}>{amount ? `${amount} ${token}` : " "}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: col }}>{usd ? `$${usd}` : " "}</div>
            </div>
            {sparkUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sparkUri} width={320} height={86} alt="" />
            ) : <div style={{ width: 1, height: 1, display: "flex" }} />}
          </div>

          {/* footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 84, height: 3, display: "flex", background: col }} />
              <div style={{ fontSize: 16, letterSpacing: 3, color: "rgba(244,243,238,0.44)" }}>{isLp ? "ON-CHAIN LIQUIDITY" : "ON-CHAIN · NON-CUSTODIAL"}</div>
            </div>
            <div style={{ fontSize: 19, letterSpacing: 2, color: "rgba(244,243,238,0.6)" }}>urizenfund.com</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
