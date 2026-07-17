import { analyzeStock, analyzeMarket, PRICES, type Depth } from "@/lib/x402-analysis";
import { gatePayment, x402Enabled } from "@/lib/x402-gate";
import { bySymbol } from "@/lib/stocks";

// Urizen x402 endpoint: a multi-agent equity thesis for a ticker, paid per call in USDC (x402).
// Dynamic pricing by depth — snapshot / standard / deep. Free until a receiving wallet is set
// (X402_PAY_TO). Uses our OpenRouter key server-side (X402_MODEL selects the model).
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const RESOURCE = "https://urizenfund.com/api/x402/analyze";

// our own browser (has an Origin on urizenfund.com); server-to-server callers have no Origin
function sameOrigin(req: Request): boolean {
  const o = req.headers.get("origin");
  if (!o) return false;
  try { const h = new URL(o).host; return h === "urizenfund.com" || h.endsWith(".urizenfund.com") || h.startsWith("localhost") || h.startsWith("127.0.0.1"); } catch { return false; }
}

function cors(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, x-payment, payment-signature", "access-control-expose-headers": "payment-response", ...(init?.headers ?? {}) },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, x-payment, payment-signature" } });
}

// Manifest / discovery: what this endpoint does + prices (for humans and x402 Bazaar-style crawlers).
function manifest() {
  return cors({
    name: "Urizen — multi-agent equity analysis",
    description: "A synthesized equity thesis fusing technicals, SEC fundamentals, analyst consensus, macro, prediction-market odds and on-chain price via an LLM analyst panel. One call, real data.",
    resource: RESOURCE,
    method: "GET",
    params: { ticker: "stock symbol (e.g. NVDA) or MARKET for whole-market sentiment", depth: "snapshot | standard | deep (default deep)" },
    pricing: { snapshot: PRICES.snapshot, standard: PRICES.standard, deep: PRICES.deep, unit: "USDC per call (x402)" },
    tiers: {
      snapshot: "3-4 sentence directional read",
      standard: "structured note: thesis, what's working, risks, catalysts",
      deep: "four-analyst panel — technical, fundamental, macro & catalyst, and news-flow & on-chain — each reading real data from the Urizen desk, synthesized by a PM into a call, bull/bear case, and what would change the view",
    },
    payments: x402Enabled() ? "x402 (USDC) — pay per call" : "currently open (free) while payments are being switched on",
    homepage: "https://urizenfund.com",
  });
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get("ticker") || url.searchParams.get("symbol") || "").replace(/^\$/, "").toUpperCase();
  if (!ticker) return manifest();

  // deep is the default product; agents pass ?depth=snapshot|standard for a cheaper tier
  const depth = (["snapshot", "standard", "deep"].includes(url.searchParams.get("depth") || "") ? url.searchParams.get("depth") : "deep") as Depth;

  // pay-per-call gate (open until X402_PAY_TO is set); price scales with depth
  const gate = await gatePayment(req, PRICES[depth], `${RESOURCE}?ticker=${ticker}&depth=${depth}`, `Urizen ${depth} analysis of ${ticker}`);
  if (!gate.ok) return gate.response;

  // CREDIT GUARD: in open (unpaid) mode, only our own site may run the LLM — never external callers,
  // or they'd burn our inference for free. External access requires payments to be switched on.
  if (gate.mode === "open" && !sameOrigin(req)) {
    return cors({ error: "x402 payments aren't switched on yet — this endpoint isn't publicly available." }, { status: 402 });
  }

  // "MARKET" is the whole-market sentiment read; otherwise it must be a known tokenized stock
  const isMarket = ticker === "MARKET";
  if (!isMarket && !bySymbol(ticker)) return cors({ error: `unknown ticker ${ticker}. Supported: MARKET, or the tokenized-stock universe on Robinhood Chain.` }, { status: 400 });

  try {
    const report = isMarket
      ? await analyzeMarket(depth, new Date().toISOString())
      : await analyzeStock(ticker, depth, new Date().toISOString());
    const headers: Record<string, string> = {};
    if (gate.mode === "paid" && gate.txHash) headers["payment-response"] = Buffer.from(JSON.stringify({ success: true, txHash: gate.txHash, payer: gate.payer })).toString("base64");
    return cors({ ...report, paid: gate.mode === "paid" }, { headers });
  } catch (e) {
    return cors({ error: `analysis failed: ${(e as Error).message}` }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
