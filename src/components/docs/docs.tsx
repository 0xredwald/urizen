"use client";

import { useState } from "react";

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative overflow-x-auto rounded-lg border border-border bg-[#08080a]">
      <button onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
        className="absolute right-2 top-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-0 transition-opacity hover:text-signal group-hover:opacity-100">{copied ? "copied" : "copy"}</button>
      <pre className="p-4 font-mono text-[12.5px] leading-relaxed text-foreground/90">{children}</pre>
    </div>
  );
}

function Endpoint({ method, path, desc, params, resp }: { method: string; path: string; desc: string; params?: [string, string][]; resp: string }) {
  return (
    <div className="grid gap-3 border-b border-border py-7">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <span className="rounded border border-signal/40 bg-signal/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-signal">{method}</span>
        <code className="font-mono text-[14px] text-foreground">{path}</code>
      </div>
      <p className="text-[15px] leading-relaxed text-muted-foreground">{desc}</p>
      {params && (
        <div className="overflow-x-auto">
          <table className="min-w-[420px] border-collapse text-[13px]">
            <tbody>
              {params.map(([k, v]) => (
                <tr key={k} className="border-b border-border/50">
                  <td className="py-1.5 pr-6 font-mono text-signal">{k}</td>
                  <td className="py-1.5 text-muted-foreground">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Code>{resp}</Code>
    </div>
  );
}

function Section({ id, title, kicker, children }: { id: string; title: string; kicker: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-signal">{kicker}</span>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const NAV = [
  ["overview", "Overview"], ["market", "Market data"], ["trading", "Trading"], ["fund", "Fund"], ["skills", "Skills"],
];

export function Docs() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-32 sm:px-8">
      <div className="mb-12 grid gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-signal">Documentation</span>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">The Urizen API.</h1>
        <p className="max-w-2xl text-[16px] leading-relaxed text-muted-foreground">
          Everything Urizen Alpha runs on is a public, keyless, CORS-open endpoint under
          <code className="mx-1 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[14px] text-foreground">urizenfund.com</code>.
          Read the market, quote a trade, or plug into the fund — from any agent.
        </p>
      </div>

      <div className="grid gap-12 lg:grid-cols-[180px_1fr]">
        <nav className="hidden self-start lg:sticky lg:top-24 lg:block">
          <div className="grid gap-1.5">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="font-mono text-[12px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-signal">{label}</a>
            ))}
          </div>
        </nav>

        <div className="grid gap-16">
          <Section id="overview" kicker="Start here" title="Your quant trading partner, non-custodial by design">
            <div className="grid gap-4 text-[15px] leading-relaxed text-muted-foreground">
              <p>Urizen Alpha is an AI equity-research agent for Robinhood Chain — research companies, analyse charts, compare businesses, explain earnings, build strategies and trade, in one conversation. Try it instantly with <span className="text-foreground">Urizen Free Mode</span> (no key, a free model), or bring your own Anthropic / OpenAI / OpenRouter key for the top models.</p>
              <p>Two things never touch a server: your intelligence key and your wallet. Your key lives in your browser and calls your provider directly; trades are quoted server-side but signed by you.</p>
              <p>Every data endpoint below returns JSON with open CORS, so an external agent (Bankr, an MCP client, your own bot) can read Urizen&apos;s live state cross-origin. The trade quote is same-origin only.</p>
            </div>
          </Section>

          <Section id="market" kicker="Grounding" title="Market data">
            <Endpoint method="GET" path="/api/quant/ohlc" desc="Real daily OHLC for a tokenized-equity underlying, with everything you need to compute technicals (RSI, volatility, Sharpe, drawdown, moving averages)."
              params={[["symbol", "ticker, e.g. NVDA (required)"], ["range", "1m · 3m · 6m · 1y · 2y (default 6m)"]]}
              resp={`{
  "symbol": "NVDA", "currency": "USD",
  "price": 208.66, "prevClose": 196.2, "range": "6m",
  "candles": [ { "t": 1730000000, "o": 132.1, "h": 135.4, "l": 131.0, "c": 134.8, "v": 41230000 }, … ]
}`} />
          </Section>

          <Section id="x402" kicker="Pay per call" title="Paid analysis (x402)">
            <Endpoint method="GET" path="/api/x402/analyze" desc="A synthesized equity thesis from a four-analyst panel (technical, fundamental, macro & catalyst, news-flow & on-chain) plus a portfolio-manager synthesis, over real data. Payable per call via x402 (HTTP 402, USDC on Base, EIP-3009 — gasless for the payer). Unpaid requests return the 402 challenge; the manifest (no ticker) returns pricing. Try it at /x402."
              params={[["ticker", "stock symbol e.g. NVDA, or MARKET for whole-market sentiment (required)"], ["depth", "snapshot ($0.01) · standard ($0.10) · deep ($0.50), default deep"]]}
              resp={`{
  "ticker": "NVDA", "name": "NVIDIA", "depth": "deep",
  "data": { "technicals": "…", "fundamentals": "…", "ratings": "…" },
  "agents": { "technical": "…", "fundamental": "…", "macro": "…", "flow": "…" },
  "thesis": "CALL — … THE CASE — … THE BEAR CASE — … WHAT WOULD CHANGE MY MIND — …",
  "paid": true
}`} />
          </Section>

          <Section id="trading" kicker="Act" title="Trading">
            <Endpoint method="GET" path="/api/rialto/quote" desc="Best-route swap quote for tokenized stocks on Robinhood Chain (id 4663), returning a ready-to-sign transaction. The routing key is attached server-side; never exposed to the browser. Non-custodial — the user sends the tx from their own wallet. Cash leg is USDG."
              params={[["sell_token", "symbol or address (required)"], ["buy_token", "symbol or address (required)"], ["sell_amount", "human decimal, e.g. 100 (required)"], ["taker", "recipient wallet (required)"], ["slippage_bps", "max slippage, default 100 (1%)"]]}
              resp={`{
  "quote_id": "…", "chain_id": 4663,
  "tx": { "to": "0x…", "data": "0x…", "value": "0" },
  "sell_amount": "100000000", "buy_amount": "…", "min_buy_amount": "…",
  "route": { "legs": [ … ] }
}`} />
          </Section>

          <Section id="fund" kicker="Allocate" title="The fund ($URI)">
            <Endpoint method="GET" path="/api/fund/stats" desc="Live $URI market data on Robinhood Chain." resp={`{
  "symbol": "URI", "name": "Urizen", "chainId": 4663,
  "priceUsd": …, "marketCapUsd": …, "fdvUsd": …, "liquidityUsd": …,
  "volume24hUsd": …, "change24hPct": …, "holders": …, "totalSupply": …
}`} />
            <Endpoint method="GET" path="/api/fund/book" desc="The fund's live on-chain positions (tokenized equities + crypto) and NAV." resp={`{
  "wallet": "0x…", "navUsd": …, "positionsCount": …,
  "positions": [ { "symbol": "NVDA", "name": "NVIDIA • Robinhood Token",
    "kind": "equity", "amount": …, "valueUsd": …, "address": "0x…" }, … ],
  "updatedAt": "…"
}`} />
            <Endpoint method="GET" path="/api/fund/strategies" desc="The autonomous mandates the fund runs, 24/7." resp={`{ "count": …, "strategies": [
  { "id": "mag7-dca", "name": "…", "kind": "DCA", "status": "live",
    "summary": "…", "targets": ["NVDA","AAPL",…], "cadence": "Every 6h · 24/7", "allocationPct": 34 }, …
] }`} />
            <Endpoint method="GET" path="/api/fund/trades" desc="The fund's on-chain execution feed." resp={`{ "count": …, "trades": [ … ], "updatedAt": "…" }`} />
            <Endpoint method="GET" path="/api/fund/mirror" desc="Copy-trade the fund: live target weights of its real book." resp={`{ "weights": [ { "symbol": "NVDA", "weightPct": … }, … ] }`} />
          </Section>

          <Section id="skills" kicker="Portable" title="Skills">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Both surfaces ship as downloadable agent skills — one for equity research (Urizen Alpha), one
              for the fund. Grab them on the <a href="/skill" className="text-signal underline underline-offset-2">skills page</a>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
