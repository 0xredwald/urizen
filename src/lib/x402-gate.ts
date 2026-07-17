// A small, self-contained x402 payment gate. It builds a spec-shaped HTTP 402 challenge with
// dynamic (per-depth) pricing and, when a payment is presented, verifies + settles it through a
// facilitator. Gated by env: with no X402_PAY_TO set it runs OPEN (free) so the endpoint is usable
// and testable; set the wallet + facilitator to switch on paid mode.
//
// Enable paid mode:  X402_PAY_TO=0xYourReceivingWallet
//   optional: X402_NETWORK=base | base-sepolia  (default base)
//             X402_FACILITATOR=https://…         (default: CDP mainnet / x402.org testnet)
//             CDP_API_KEY_ID, CDP_API_KEY_SECRET (mainnet CDP facilitator auth)

const USDC: Record<string, string> = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

function cfg() {
  const payTo = process.env.X402_PAY_TO || "";
  const network = process.env.X402_NETWORK || "base";
  const facilitator = process.env.X402_FACILITATOR || (network === "base-sepolia" ? "https://x402.org/facilitator" : "https://api.cdp.coinbase.com/platform/v2/x402");
  return { payTo, network, facilitator, asset: USDC[network] || USDC.base, enabled: !!payTo };
}

// "$0.20" -> USDC base units (6 dp) as a string.
function toUnits(price: string): string {
  const usd = parseFloat(price.replace(/[^0-9.]/g, "")) || 0;
  return String(Math.round(usd * 1_000_000));
}

export type GateResult =
  | { ok: true; mode: "open" | "paid"; payer?: string; txHash?: string }
  | { ok: false; response: Response };

/** Gate a request. `price` like "$0.20", `resource` is the canonical URL, `description` for the paywall. */
export async function gatePayment(req: Request, price: string, resource: string, description: string): Promise<GateResult> {
  const c = cfg();
  if (!c.enabled) return { ok: true, mode: "open" }; // free until a receiving wallet is configured

  const requirements = {
    scheme: "exact",
    network: c.network,
    maxAmountRequired: toUnits(price),
    resource,
    description,
    mimeType: "application/json",
    payTo: c.payTo,
    asset: c.asset,
    maxTimeoutSeconds: 300,
    extra: { name: "USDC", version: "2" },
  };
  const challenge = () =>
    new Response(JSON.stringify({ x402Version: 1, error: "payment required", accepts: [requirements] }), {
      status: 402,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });

  const header = req.headers.get("x-payment") || req.headers.get("payment-signature");
  if (!header) return { ok: false, response: challenge() };

  // present a payment -> verify + settle via the facilitator
  try {
    let payload: unknown;
    try { payload = JSON.parse(Buffer.from(header, "base64").toString("utf8")); } catch { payload = header; }
    const fac = async (path: string) => {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
        headers.authorization = `Bearer ${process.env.CDP_API_KEY_SECRET}`; // CDP-hosted facilitators accept the secret; JWT variant handled upstream
      }
      const r = await fetch(`${c.facilitator}${path}`, { method: "POST", headers, body: JSON.stringify({ x402Version: 1, paymentPayload: payload, paymentRequirements: requirements }) });
      return { ok: r.ok, body: await r.json().catch(() => ({})) };
    };
    const verified = await fac("/verify");
    if (!verified.ok || (verified.body as { isValid?: boolean }).isValid === false) return { ok: false, response: challenge() };
    const settled = await fac("/settle");
    const b = settled.body as { txHash?: string; transaction?: string; payer?: string };
    return { ok: true, mode: "paid", txHash: b.txHash || b.transaction, payer: b.payer };
  } catch {
    return { ok: false, response: challenge() };
  }
}

export const x402Enabled = () => !!process.env.X402_PAY_TO;
