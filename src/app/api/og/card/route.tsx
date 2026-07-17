import { ImageResponse } from "next/og";

// Branded Urizen card — Blake's "Ancient of Days" as a darkened background, the real Urizen mark,
// and the message baked in. Used as the bot's image fallback + share cards. Query: ?tag=&title=&sub=
export const runtime = "edge";

const SIGNAL = "#34F003";
const BG = "https://urizenfund.com/img/blake-ancient.jpg";
const MARK = "https://urizenfund.com/img/mark-green.png";
const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function GET(req: Request) {
  const u = new URL(req.url);
  const tag = clamp(u.searchParams.get("tag") || "URIZEN ALPHA", 40).toUpperCase();
  const title = clamp(u.searchParams.get("title") || "On-chain equity research", 120);
  const sub = clamp(u.searchParams.get("sub") || "", 160);

  return new ImageResponse(
    (
      <div style={{ position: "relative", width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BG} width={1200} height={630} alt="" style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover", objectPosition: "center 16%" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, display: "flex", background: "linear-gradient(115deg, rgba(6,7,6,0.95) 0%, rgba(6,7,6,0.78) 52%, rgba(6,10,6,0.9) 100%)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, display: "flex", background: "radial-gradient(60% 75% at 84% 14%, rgba(52,240,3,0.18) 0%, transparent 60%)" }} />

        <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "62px 66px", fontFamily: "monospace" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MARK} width={46} height={46} alt="" />
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 8, color: "#f4f3ee" }}>URIZEN</div>
            </div>
            <div style={{ fontSize: 18, letterSpacing: 3, color: SIGNAL, border: `1px solid ${SIGNAL}`, borderRadius: 999, padding: "9px 20px" }}>{tag}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: title.length > 58 ? 58 : 76, fontWeight: 700, color: "#f4f3ee", lineHeight: 1.04, letterSpacing: -1 }}>{title}</div>
            {sub ? <div style={{ fontSize: 30, color: "rgba(244,243,238,0.68)", lineHeight: 1.3 }}>{sub}</div> : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 96, height: 3, display: "flex", background: SIGNAL }} />
              <div style={{ fontSize: 16, letterSpacing: 3, color: "rgba(244,243,238,0.44)" }}>ROBINHOOD CHAIN</div>
            </div>
            <div style={{ fontSize: 20, letterSpacing: 2, color: "rgba(244,243,238,0.6)" }}>urizenfund.com</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
