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
// The EIP-712 domain the client signs the transferWithAuthorization against MUST match the token's
// on-chain name()/version() exactly, or the facilitator rejects it (invalid_payload). Base mainnet
// USDC reports name "USD Coin" (verified on-chain); testnet USDC reports "USDC".
const USDC_DOMAIN: Record<string, { name: string; version: string }> = {
  base: { name: "USD Coin", version: "2" },
  "base-sepolia": { name: "USDC", version: "2" },
};

function cfg() {
  const payTo = process.env.X402_PAY_TO || "";
  const network = process.env.X402_NETWORK || "base";
  const facilitator = process.env.X402_FACILITATOR || (network === "base-sepolia" ? "https://x402.org/facilitator" : "https://api.cdp.coinbase.com/platform/v2/x402");
  return { payTo, network, facilitator, asset: USDC[network] || USDC.base, domain: USDC_DOMAIN[network] || USDC_DOMAIN.base, enabled: !!payTo };
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
    extra: c.domain, // the token's real EIP-712 domain — must match on-chain name()/version()
  };
  // `debug` is included only when a payment WAS presented but rejected — it surfaces the facilitator's
  // reason (invalidReason / errorReason) so a failed test call says WHY. Not sensitive.
  const challenge = (debug?: unknown) =>
    new Response(JSON.stringify({ x402Version: 1, error: "payment required", accepts: [requirements], ...(debug ? { _debug: debug } : {}) }), {
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
      // CDP's facilitator authenticates with a per-request Ed25519-signed JWT (not a raw secret).
      const id = process.env.CDP_API_KEY_ID, secret = process.env.CDP_API_KEY_SECRET;
      if (id && secret) {
        try {
          const { generateJwt } = await import("@coinbase/cdp-sdk/auth");
          const u = new URL(`${c.facilitator}${path}`);
          const jwt = await generateJwt({ apiKeyId: id, apiKeySecret: secret, requestMethod: "POST", requestHost: u.host, requestPath: u.pathname, expiresIn: 120 });
          headers.authorization = `Bearer ${jwt}`;
        } catch { /* JWT build failed → the facilitator will 401 and we return a challenge, never serving */ }
      }
      const r = await fetch(`${c.facilitator}${path}`, { method: "POST", headers, body: JSON.stringify({ x402Version: 1, paymentPayload: payload, paymentRequirements: requirements }) });
      return { ok: r.ok, body: await r.json().catch(() => ({})) };
    };
    const verified = await fac("/verify");
    if (!verified.ok || (verified.body as { isValid?: boolean }).isValid === false) {
      return { ok: false, response: challenge({ stage: "verify", ok: verified.ok, ...(verified.body as object) }) };
    }
    // NEVER serve unless settlement actually succeeded — otherwise a verify-ok / settle-fail request
    // would get the analysis for free. Require settle to return ok + success.
    const settled = await fac("/settle");
    const b = settled.body as { txHash?: string; transaction?: string; payer?: string; success?: boolean; errorReason?: string };
    if (!settled.ok || b.success === false || (!b.txHash && !b.transaction)) {
      return { ok: false, response: challenge({ stage: "settle", ok: settled.ok, ...(b as object) }) };
    }
    return { ok: true, mode: "paid", txHash: b.txHash || b.transaction, payer: b.payer };
  } catch (e) {
    return { ok: false, response: challenge({ stage: "exception", error: String((e as Error)?.message || e).slice(0, 200) }) };
  }
}

export const x402Enabled = () => !!process.env.X402_PAY_TO;
