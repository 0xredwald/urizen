import { NextResponse } from "next/server";
import { ROBINHOOD_CHAIN } from "@/lib/chain";

// Server-side proxy to Rialto's trade API. The RIALTO_API_KEY lives ONLY here (server env) —
// never shipped to the browser. The client asks for a quote; we attach the bearer key, forward
// to Rialto, and return the route + a ready-to-sign transaction the user's wallet executes.
// Non-custodial: URIZEN never signs. Because this route spends OUR routing key, it is SAME-ORIGIN
// only (no open CORS) so other sites cannot burn our quota.
export const revalidate = 0;

const RIALTO = "https://rialto-trade-api.rialto.xyz";
// no ACAO header → browsers block cross-origin reads of this key-spending endpoint
const json = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);

// reject cross-site browser requests (allow same-origin + server-to-server with no Origin header)
function crossOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = new URL(origin).host; // includes :port
    const ok =
      host === "urizenfund.com" || host.endsWith(".urizenfund.com") ||
      host === "localhost" || host.startsWith("localhost:") ||
      host === "127.0.0.1" || host.startsWith("127.0.0.1:");
    return !ok;
  } catch { return true; }
}

export async function GET(req: Request) {
  if (crossOrigin(req)) return json({ error: "forbidden" }, { status: 403 });
  const key = process.env.RIALTO_API_KEY;
  if (!key) {
    return json(
      { error: "trading not configured", detail: "RIALTO_API_KEY is not set on the server yet." },
      { status: 503 },
    );
  }

  const u = new URL(req.url);
  const sell = u.searchParams.get("sell_token");
  const buy = u.searchParams.get("buy_token");
  const amount = u.searchParams.get("sell_amount");
  const taker = u.searchParams.get("taker");
  // default 2% — Robinhood-Chain stock pools are thin, and 1% reverted often (the "didn't go through"
  // retries). Callers can still pass a tighter value.
  const slippageBps = u.searchParams.get("slippage_bps") || "200";
  if (!sell || !buy || !amount || !taker) {
    return json({ error: "sell_token, buy_token, sell_amount and taker are required" }, { status: 400 });
  }
  // input hardening — never forward malformed values to the upstream (the key stays server-side)
  if (!/^0x[a-fA-F0-9]{40}$/.test(taker)) {
    return json({ error: "invalid taker address" }, { status: 400 });
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0 || amt > 1e9) {
    return json({ error: "invalid sell_amount" }, { status: 400 });
  }
  const isTok = (t: string) => /^0x[a-fA-F0-9]{40}$/.test(t) || /^[A-Za-z]{2,12}$/.test(t);
  if (!isTok(sell) || !isTok(buy)) {
    return json({ error: "invalid token" }, { status: 400 });
  }

  const q = new URLSearchParams({
    sell_token: sell,
    buy_token: buy,
    sell_amount: amount,
    taker,
    slippage_bps: slippageBps,
    chain_id: String(ROBINHOOD_CHAIN.id),
    settlement: "auto",
  });
  // Integrator fee — this is how the fund earns on routed swaps. Our Rialto key ("ctrl") is an
  // integrator key with a 20 bps cap and the payout wallet bound server-side; the fee is paid to it
  // atomically on every executed swap. Default every quote to the cap so we actually collect it
  // (was never sent before → zero fees). Tune with RIALTO_FEE_BPS; a client may override, "0" disables.
  const feeBps = u.searchParams.get("swap_fee_bps") || process.env.RIALTO_FEE_BPS || "20";
  const feeToken = u.searchParams.get("swap_fee_token");
  if (feeBps && feeBps !== "0") q.set("swap_fee_bps", feeBps);
  if (feeToken) q.set("swap_fee_token", feeToken);

  try {
    const res = await fetch(`${RIALTO}/quote?${q.toString()}`, {
      headers: { authorization: `Bearer ${key}`, accept: "application/json" },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ error: data?.error || data?.message || `rialto ${res.status}`, detail: data }, { status: res.status });
    }
    return json(data);
  } catch (e) {
    return json({ error: `quote failed: ${(e as Error).message}` }, { status: 502 });
  }
}
