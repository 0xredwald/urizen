// Client-side Rialto helpers: resolve tokens, fetch a quote (via our key-injecting proxy), and
// execute the returned transaction through the user's wallet on Robinhood Chain. Non-custodial —
// the user signs every trade. The agent can only PROPOSE a swap (see SwapProposal); it never signs.

import { ROBINHOOD_CHAIN, RH_TOKENS } from "./chain";
import { bySymbol } from "./stocks";

export const USDG = RH_TOKENS.usdg;     // 6-dec cash leg
export const WETH = RH_TOKENS.weth;
export const USDG_DECIMALS = RH_TOKENS.usdgDecimals; // 6
const STOCK_DECIMALS = 18;
// native-asset sentinel used by aggregators for native ETH (the chain's gas token)
export const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/** Resolve a symbol ("NVDA", "USDG", "ETH", "WETH") to its RH token address + decimals. */
export function resolveToken(symbolOrAddr: string): { address: string; decimals: number; symbol: string; native?: boolean } {
  const s = symbolOrAddr.replace(/^\$/, "").toUpperCase();
  if (s === "USDG") return { address: USDG, decimals: USDG_DECIMALS, symbol: "USDG" };
  if (s === "ETH") return { address: NATIVE, decimals: 18, symbol: "ETH", native: true };
  if (s === "WETH") return { address: WETH, decimals: 18, symbol: "WETH" };
  const stock = bySymbol(s);
  if (stock) return { address: stock.address, decimals: STOCK_DECIMALS, symbol: s };
  if (symbolOrAddr.startsWith("0x")) return { address: symbolOrAddr, decimals: 18, symbol: s };
  throw new Error(`unknown token ${symbolOrAddr}`);
}

export type Permit2Payload = {
  owner: string;
  domain: { chainId: number; name: string; verifyingContract: string; version?: string };
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
};

export type Quote = {
  quote_id: string;
  chain_id: number;
  settlement: string; // "permit2" | "allowance" | "auto"
  tx: { to: string; data: string; value?: string; signature_offset?: number };
  sell_amount: string;
  buy_amount: string;
  min_buy_amount: string;
  platform_fee?: unknown;
  network_fee?: number;
  route?: { legs?: unknown[] };
  permit2?: Permit2Payload;
  issues?: { balance?: unknown; allowance?: { actual?: string; spender?: string } | null; simulationIncomplete?: unknown };
};

// The canonical Permit2 contract (same address on every chain, incl. Robinhood Chain).
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/** Splice a 65-byte Permit2 signature into the quote's calldata (replacing the placeholder). */
export function spliceSignature(data: string, signature: string, offset?: number): string {
  const sig = signature.replace(/^0x/, "");
  const placeholder = "ab".repeat(65);
  if (offset != null) {
    const pos = 2 + offset * 2;
    if (data.slice(pos, pos + 130).toLowerCase() === placeholder) {
      return data.slice(0, pos) + sig + data.slice(pos + 130);
    }
  }
  // fallback: replace the placeholder run wherever it is
  const idx = data.toLowerCase().indexOf(placeholder);
  if (idx >= 0) return data.slice(0, idx) + sig + data.slice(idx + 130);
  return data;
}

/** Strip EIP712Domain from the types map (viem derives the domain separately). */
export function permit2SignTypes(p: Permit2Payload): Record<string, { name: string; type: string }[]> {
  const { EIP712Domain: _omit, ...rest } = p.types;
  void _omit;
  return rest;
}

export type QuoteError = { error: string; detail?: unknown; notConfigured?: boolean };

/** Ask for a quote to sell `sellAmount` (human decimal) of sellSym → buySym, delivered to `taker`. */
export async function getQuote(opts: {
  sellSym: string; buySym: string; sellAmount: string; taker: string; slippageBps?: number;
}): Promise<Quote> {
  const sell = resolveToken(opts.sellSym);
  const buy = resolveToken(opts.buySym);
  const q = new URLSearchParams({
    sell_token: sell.address,
    buy_token: buy.address,
    sell_amount: opts.sellAmount,
    taker: opts.taker,
    slippage_bps: String(opts.slippageBps ?? 100),
  });
  const res = await fetch(`/api/rialto/quote?${q.toString()}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error || "quote failed") as Error & { notConfigured?: boolean };
    err.notConfigured = res.status === 503;
    throw err;
  }
  return data as Quote;
}

/** Format a raw integer amount to a human string given decimals. */
export function fromRaw(raw: string, decimals: number): number {
  if (!raw) return 0;
  return Number(raw) / 10 ** decimals;
}

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

/** Ensure the wallet is on Robinhood Chain (add it if unknown), then return the provider. */
export async function ensureRobinhoodChain(): Promise<Eth> {
  const eth = (window as unknown as { ethereum?: Eth }).ethereum;
  if (!eth) throw new Error("no wallet");
  const hexId = "0x" + ROBINHOOD_CHAIN.id.toString(16);
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch (e: unknown) {
    // 4902 = chain unknown to the wallet → add it
    if ((e as { code?: number })?.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hexId,
          chainName: ROBINHOOD_CHAIN.name,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [ROBINHOOD_CHAIN.rpc],
          blockExplorerUrls: [ROBINHOOD_CHAIN.blockscout],
        }],
      });
    } else {
      throw e;
    }
  }
  return eth;
}

/** Execute a quoted swap by sending its transaction from the user's wallet. Returns the tx hash. */
export async function executeQuote(quote: Quote, from: string): Promise<string> {
  // defense-in-depth: never sign a quote for a different chain than Robinhood Chain
  if (quote.chain_id && quote.chain_id !== ROBINHOOD_CHAIN.id) {
    throw new Error(`quote chain mismatch: ${quote.chain_id} ≠ ${ROBINHOOD_CHAIN.id}`);
  }
  const eth = await ensureRobinhoodChain();
  const tx: Record<string, string> = {
    from,
    to: quote.tx.to,
    data: quote.tx.data,
  };
  if (quote.tx.value && quote.tx.value !== "0") {
    tx.value = "0x" + BigInt(quote.tx.value).toString(16);
  }
  const hash = (await eth.request({ method: "eth_sendTransaction", params: [tx] })) as string;
  return hash;
}

// ── the agent's swap proposal (it proposes; the user signs) ──
export type SwapProposal = {
  sellSym: string;
  buySym: string;
  sellAmount: string; // human decimal
  rationale?: string;
};
