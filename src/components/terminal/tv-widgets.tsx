"use client";

import { useEffect, useRef } from "react";

/**
 * Base wrapper for free TradingView embed widgets.
 *
 * TradingView widgets work by injecting an async <script> whose src points at
 * embed-widget-<name>.js and whose innerHTML is JSON.stringify(config), into a
 * container div. The widget renders its own attribution/copyright link which we
 * MUST keep (ToS requirement) — so we never strip it.
 */
export function TVWidget({
  name,
  config,
  className,
}: {
  name: string;
  config: Record<string, unknown>;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // SSR guard: only touch the DOM inside the effect.
    if (typeof window === "undefined") return;
    const container = ref.current;
    if (!container) return;

    // Clear any previous render.
    container.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";

    const script = document.createElement("script");
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${name}.js`;
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify(config);

    container.appendChild(widget);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
    // Re-run when the widget name or its config changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, JSON.stringify(config)]);

  return (
    <div
      ref={ref}
      className={
        "tradingview-widget-container h-full w-full overflow-hidden " +
        (className || "")
      }
    />
  );
}

/** News timeline — market-wide or symbol-specific. */
export function TVNews({ symbol }: { symbol?: string }) {
  const feed: Record<string, unknown> = symbol
    ? { feedMode: "symbol", symbol: `NASDAQ:${symbol}` }
    : { feedMode: "market", market: "stock" };

  return (
    <TVWidget
      name="timeline"
      config={{
        ...feed,
        displayMode: "regular",
        colorTheme: "dark",
        isTransparent: true,
        width: "100%",
        height: "100%",
        locale: "en",
      }}
    />
  );
}

/** US economic calendar. */
export function TVEconCalendar() {
  return (
    <TVWidget
      name="events"
      config={{
        importanceFilter: "-1,0,1",
        countryFilter: "us",
        colorTheme: "dark",
        isTransparent: true,
        width: "100%",
        height: "100%",
        locale: "en",
      }}
    />
  );
}

/** Scrolling ticker tape. */
export function TVTickerTape({
  symbols,
}: {
  symbols?: { proName: string; title: string }[];
}) {
  const defaultSymbols = [
    { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
    { proName: "FOREXCOM:NSXUSD", title: "Nasdaq 100" },
    { proName: "NASDAQ:NVDA", title: "NVIDIA" },
    { proName: "NASDAQ:TSLA", title: "Tesla" },
    { proName: "NASDAQ:AAPL", title: "Apple" },
    { proName: "BITSTAMP:BTCUSD", title: "Bitcoin" },
  ];

  return (
    <TVWidget
      name="ticker-tape"
      config={{
        symbols: symbols ?? defaultSymbols,
        displayMode: "adaptive",
        colorTheme: "dark",
        isTransparent: true,
        locale: "en",
      }}
    />
  );
}

/** Market movers hotlists. */
export function TVHotlists() {
  return (
    <TVWidget
      name="hotlists"
      config={{
        colorTheme: "dark",
        dateRange: "1D",
        exchange: "US",
        showChart: false,
        isTransparent: true,
        width: "100%",
        height: "100%",
        locale: "en",
      }}
    />
  );
}

/** Sector stock heatmap. */
export function TVHeatmap() {
  return (
    <TVWidget
      name="stock-heatmap"
      config={{
        exchanges: [],
        dataSource: "SPX500",
        grouping: "sector",
        blockSize: "market_cap_basic",
        blockColor: "change",
        colorTheme: "dark",
        hasTopBar: false,
        isDataSetEnabled: false,
        isZoomEnabled: true,
        isMonoSize: false,
        width: "100%",
        height: "100%",
        locale: "en",
      }}
    />
  );
}
