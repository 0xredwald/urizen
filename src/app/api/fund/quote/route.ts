import { NextRequest } from "next/server";
import { json, options } from "@/lib/api";
import { URIZEN_TOKEN, ROBINHOOD_CHAIN } from "@/lib/chain";

export const revalidate = 0;
export const OPTIONS = options;

// The executable swap is built by CTRL's Doppler-router engine (fork-verified). This route is the
// agent-facing wrapper: an agent asks "quote me N ETH of $URI" and gets an est-out + a ready tx
// ({to, data, value}) its wallet can sign — routed on Robinhood Chain.
const CTRL = "https://www.ctrl.build/api/launch/cfa5bb80-e54f-4ecd-a254-f77fa9067d05/buy-quote";

/** GET /api/fund/quote?side=buy|sell&amount=0.01&taker=0x... */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const side = p.get("side") === "sell" ? "sell" : "buy";
  const amount = p.get("amount") ?? "0.01";
  const taker = p.get("taker") ?? "";
  const slippageBps = p.get("slippageBps") ?? "300";
  try {
    const url = `${CTRL}?side=${side}&amount=${encodeURIComponent(amount)}${taker ? `&taker=${taker}` : ""}&slippageBps=${slippageBps}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    return json({
      token: URIZEN_TOKEN,
      chainId: ROBINHOOD_CHAIN.id,
      side,
      amount,
      estOut: d?.estOut ?? null,
      route: d?.route ?? null,
      tx: d?.to ? { to: d.to, data: d.data, value: d.value ?? "0" } : null,
      spender: d?.spender ?? null,
      error: d?.error ?? null,
    });
  } catch {
    return json({ error: "quote_unavailable", token: URIZEN_TOKEN, chainId: ROBINHOOD_CHAIN.id }, { status: 502 });
  }
}
