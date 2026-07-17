"use client";

import { useState } from "react";
import { UrizenMark } from "@/components/brand/marks";

// files that live in public/logos/stocks/
const PNG = new Set([
  "AAPL", "AMD", "AMZN", "ASML", "AVGO", "BABA", "CLSK", "COIN", "CRCL", "CRWV",
  "GME", "GOOGL", "HOOD", "INTC", "IONQ", "META", "MSFT", "MSTR", "MU", "NBIS",
  "NFLX", "NVDA", "ORCL", "PLTR", "QQQ", "RGTI", "RKLB", "SGOV", "SLV", "SNDK",
  "SPY", "TSLA",
]);
const SVG = new Set(["WETH", "USDG", "ETH"]);

function src(sym: string): string | null {
  if (PNG.has(sym)) return `/logos/stocks/${sym}.png`;
  if (SVG.has(sym)) return `/logos/stocks/${sym}.svg`;
  return null;
}

/** Real asset logo on a uniform white token chip — every holding recognizable,
 *  none invisible. $URI shows the Urizen mark; unknown tickers get a monogram. */
export function StockLogo({
  symbol,
  size = 44,
  className = "",
}: {
  symbol: string;
  size?: number;
  className?: string;
}) {
  const sym = (symbol || "").replace(/^\$/, "").toUpperCase();
  const [broke, setBroke] = useState(false);
  const box = `${size}px`;
  const base = "grid place-items-center shrink-0 overflow-hidden rounded-full " + className;

  if (sym === "URI" || sym === "URIZEN") {
    return (
      <span className={`${base} border border-signal/30 bg-[#0f1a0c]`} style={{ width: box, height: box }}>
        <UrizenMark className="h-1/2 w-auto text-signal" />
      </span>
    );
  }

  const url = src(sym);
  if (url && !broke) {
    return (
      <span className={`${base} bg-white ring-1 ring-white/15`} style={{ width: box, height: box }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={sym}
          width={size}
          height={size}
          loading="lazy"
          onError={() => setBroke(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={`${base} border border-white/12 bg-[#141416] font-display font-semibold tracking-tight text-foreground/85`}
      style={{ width: box, height: box, fontSize: size * (sym.length > 3 ? 0.28 : 0.34) }}
    >
      {sym}
    </span>
  );
}
