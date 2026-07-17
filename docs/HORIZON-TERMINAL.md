# Horizon Terminal — architecture & build plan

A Bloomberg-style, agent-driven trading terminal for URIZEN. Route: **`/terminal`**.
Branch: **`horizon-terminal`** (built locally on daxaur/urizen, shipped to `0xredwald/urizen`).

Reference: "Feather" — numbered-pane terminal (markets/watchlist rail · chart with drawing tools ·
liquidity/movers · trade · alerts). Ours: same clean bones, **our identity** (neon-green `#34F003`
on near-black, faint William-Blake "Ancient of Days" line-work behind), with the **Horizon agent**
occupying the right rail and able to actually *operate* the terminal.

## The one belief
The terminal isn't a dashboard you read — it's a surface a smart agent *operates in front of you*.
You watch Horizon move a visible cursor, draw on the chart, add indicators, pull news, open new
charts, and propose trades that pop into your wallet. It has to feel alive and be genuinely useful.

## Stack (OSS; confirmed against research)
- **Chart:** KLineChart (`klinecharts`, Apache-2.0) — candles + volume + built-in indicators + a
  *programmatic* overlay/indicator API so the agent can draw trendlines/rects/markers and add
  indicators from code. (Lightweight-Charts is cleaner-looking but can't do agent drawings without
  custom primitive plugins — KLineChart wins for an agent-drawable chart.)
- **Layout:** start with CSS-grid panes for a working shell; upgrade to **Dockview** (`dockview-react`,
  MIT) — real docking (tabs, groups, splits, **floating + popout windows**, `toJSON`/`fromJSON` layout
  save/restore) = "customize however you want" + the multi-chart playground. (Beats react-grid-layout,
  which is a fixed widget grid, not rearrangeable IDE-style panes.)
- **Agent cursor:** `perfect-cursors` (MIT, tldraw's spline cursor engine — smooth traces from
  discrete agent targets) + Motion (`motion`, MIT) for press ripples. A fixed, pointer-events-none
  cursor element driven by an action queue. Chart `convertToPixel({timestamp,price})` maps tool args
  to screen coords the cursor traces before the real overlay is drawn.
- **Agent brain:** reuse `src/lib/agents.ts` — browser BYOK vault (`getActiveBinding`) + `callModel`.
  No server LLM, no new SDK. Horizon speaks a **JSON tool-action protocol** (provider-agnostic;
  same shape as `analyzeScreen`): the model returns `{ say, actions:[{tool,args}] }`, the client
  executes each action + animates the cursor. **Deliberately NOT the Vercel AI SDK server route** —
  URIZEN's key never touches our server (BYOK), and Free Mode's model needs a protocol that works
  without native tool-calling. JSON-action is the robust, on-architecture choice.
- **Wallet / trades:** wagmi `useSendTransaction`/`writeContract`; spot via `/api/rialto/quote`.
- **Data:** existing `/api/quant/*` (ohlc, market, movers, news, fundamentals, ratings, macro,
  predictions, onchain), `/api/fund/*`, `/api/rialto/quote`. No new backend for v1.

## Panes (numbered, customizable)
1. Markets (universe: ticker · last · premium; ALL/STOCK/ETF; ★ watch) — `/api/quant/movers` + universe
2. Watchlist (localStorage) — sym · last · 24h
3. Stock performance header (selected symbol · price · Δ · session)
4. Chart(s) — KLineChart, timeframes, indicators, drawing tools; **agent-drawable**; multi-pane
5. Liquidity (token · top pair · vol 24h) — onchain/dexscreener
6. Movers (ticker · price · 24h)
7. Trade (buy/sell · you pay/receive · 25/50/75/max · slippage · connect) — Rialto spot; perps where available
8. Alerts (price alerts, localStorage)
**Right rail — Horizon:** chat + streaming tool-actions + the cursor it controls.

## Horizon tool schema (client actions)
`openChart(symbol,timeframe?)` · `setTimeframe(tf)` · `focusChart(id)` · `addIndicator(name,params?)` ·
`removeIndicator(name)` · `drawTrendline(p1,p2)` · `drawRect(p1,p2)` · `drawHLine(price)` ·
`placeMarker(t,price,label)` · `annotate(t,price,text)` · `checkNews(symbol)` · `screen(filter)` ·
`proposeTrade({side,symbol,amount,kind:spot|perp})` · `clearDrawings(chartId?)`.
Each action maps to a dispatcher that (a) performs the UI op via a chart/terminal ref API and
(b) enqueues a cursor move so the user *sees* it happen.

## Agent cursor system
- A single `<HorizonCursor>` overlay (fixed, pointer-events-none) with the Urizen mark as the pointer.
- An action queue: `moveTo(x,y)` → spring; `press()` → ripple; `traceLine(a,b)` → cursor glides a→b
  while the chart overlay draws. Chart exposes `coord(t,price)→{x,y}` so tool args (time/price) map
  to screen pixels for the cursor to trace. Idle → gentle float. Honors `prefers-reduced-motion`.
- "Alive" cues: typing shimmer, a status line ("reading the tape…", "drawing support…"),
  the cursor easing between actions.

## Perps (CONFIRMED via research)
RH chain (4663) is **spot tokenized-equities only — no native perps.** Robinhood's own "perps" are
**Lighter** (crypto-only, on Lighter's separate zk-rollup), merely surfaced in the RH wallet. So any
perps here are an **external-venue integration** — the position lives off-4663 and the UI must say so.
- **Primary (equities): Ostium** (Arbitrum) — purpose-built RWA/stock perp DEX, ~33 stock pairs
  (NVDA/TSLA/SPY…), wagmi-native EVM execution, OSS Python+TS SDKs, REST latest-prices + subgraph.
  On-thesis for an equities product. Read-side (marks/funding/OI) ships first; execution via wagmi.
- **Crypto perps data: Hyperliquid** (`/info` + WS, no-auth) — deepest book, clean read API.
- **Second equities source: Gains/gTrade** (Arbitrum/Base) — synthetic stock+FX+index perps.
v1 = Ostium + Hyperliquid **read/charts** in the terminal (honest "external venue" label); Ostium
wagmi execution as the first write path. Not promised as on-RH-chain.

## Build order (phased)
- **P1 — shell:** `/terminal` route, theme tokens, Blake bg, static pane grid, markets/movers rails on real data, top + bottom bars. ✅ ship first, verify by screenshot.
- **P2 — chart:** KLineChart integration, clean themed candles+volume, timeframes, indicators, drawing tools; a `ChartHandle` API (openChart, addIndicator, draw*, coord()).
- **P3 — Horizon:** right-rail chat, JSON tool-action loop over `callModel`, the dispatcher, the visible cursor, "alive" motion.
- **P4 — trades:** trade panel + wagmi wallet popups; agent `proposeTrade`; perps market-data.
- **P5 — playground:** draggable/resizable panes (react-grid-layout), multi-chart, layout persistence.
- **P6 — polish:** motion, reduced-motion, responsive, verify each surface, push branch → `0xredwald/urizen` (authored as redwald), open PR; keep daxaur repo synced for deploy.

## Principles
Real data only (no fabricated numbers). Non-custodial (agent *proposes*, user signs). Smooth +
reduced-motion-safe. Reuse the existing quant/agent/Blake infra; add libraries only where needed.
