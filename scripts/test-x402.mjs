// Real x402 test: pays for one Urizen analysis with a Base wallet, prints the result + any reason.
// Setup:  npm i x402-fetch viem
// Run:    TEST_PK=0xYOUR_BASE_WALLET_KEY node scripts/test-x402.mjs
// Note:   use a wallet that is NOT the payTo (0x0716e016…). Needs a little USDC on Base. Gasless.
import { wrapFetchWithPayment } from "x402-fetch";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const pk = process.env.TEST_PK;
if (!pk) { console.error("Set TEST_PK=0x... (a Base wallet with a little USDC, not the payTo)"); process.exit(1); }

const account = privateKeyToAccount(pk);
const wallet = createWalletClient({ account, chain: base, transport: http() });
const pay = wrapFetchWithPayment(fetch, wallet);

const url = "https://urizenfund.com/api/x402/analyze?ticker=NVDA&depth=snapshot";
console.log("Paying + calling", url, "\n  as", account.address);
try {
  const res = await pay(url);
  console.log("HTTP", res.status);
  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));
  if (res.status === 402 && body._debug) console.log("\n>>> facilitator rejected the payment at:", body._debug.stage, "\n>>> reason:", JSON.stringify(body._debug));
  else if (res.status === 402) console.log("\n>>> No _debug field = x402-fetch never sent a payment (client-side / no USDC / self-pay).");
  else if (res.status === 200) console.log("\n>>> SUCCESS — payment settled + analysis returned.");
} catch (e) {
  console.error("\n>>> x402-fetch threw:", e?.message || e);
}
