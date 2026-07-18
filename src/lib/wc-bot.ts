// WalletConnect from the Telegram bot — pair the user's wallet ONCE, then push transactions straight
// to their wallet to sign (no web page, no link). The relay is store-and-forward, so a short-lived
// serverless function can init the SignClient, fire a request, and await the in-wallet approval (≤~55s,
// within the 60s function budget). Sessions persist in our locked store so they survive cold starts.
// Non-custodial: the bot only ASKS; the user approves in their own wallet.

import SignClient from "@walletconnect/sign-client";
import { createPublicClient, http, encodeFunctionData, erc20Abi, maxUint256 } from "viem";
import { resolveToken, type Quote } from "./rialto";
import { ROBINHOOD_CHAIN } from "./chain";
import { wcGet, wcSet, wcDel } from "./bot-store";

const RH = 4663;
const RH_CAIP = `eip155:${RH}`;
const kvNs = (id: number) => `kv:${id}`;
const sessNs = (id: number) => `session:${id}`;

export const wcEnabled = () => {
  const p = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
  return !!p && p !== "urizen_alpha_default" && p.length > 10;
};

const publicClient = createPublicClient({ transport: http(ROBINHOOD_CHAIN.rpc) });

// SignClient keyvalue storage backed by our DB — loaded once, held in memory, flushed on commit().
class DbStorage {
  private map: Map<string, unknown> | null = null;
  constructor(private ns: string) {}
  private async ensure() { if (!this.map) this.map = new Map(Object.entries(await wcGet(this.ns))); }
  async getItem<T = unknown>(k: string): Promise<T | undefined> { await this.ensure(); return this.map!.get(k) as T | undefined; }
  async setItem<T = unknown>(k: string, v: T): Promise<void> { await this.ensure(); this.map!.set(k, v as unknown); }
  async removeItem(k: string): Promise<void> { await this.ensure(); this.map!.delete(k); }
  async getKeys(): Promise<string[]> { await this.ensure(); return [...this.map!.keys()]; }
  async getEntries<T = unknown>(): Promise<[string, T][]> { await this.ensure(); return [...this.map!.entries()] as [string, T][]; }
  async commit(): Promise<void> { if (this.map) await wcSet(this.ns, Object.fromEntries(this.map)); }
}

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

async function initClient(storage: DbStorage): Promise<InstanceType<typeof SignClient>> {
  return SignClient.init({
    projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "",
    metadata: { name: "Urizen", description: "Urizen Alpha — your on-chain equity desk", url: "https://urizenfund.com", icons: ["https://urizenfund.com/img/bot-welcome.jpg"] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storage: storage as any,
  });
}

// Start pairing → returns the wc: uri to open the wallet, plus a promise that resolves with the linked
// address once the user approves in-wallet (awaited within one invocation).
export async function startPairing(chatId: number): Promise<{ uri: string; approved: Promise<string | null> }> {
  const storage = new DbStorage(kvNs(chatId));
  const sc = await initClient(storage);
  const { uri, approval } = await sc.connect({
    // 4663 under OPTIONAL so any wallet pairs even if it doesn't pre-know Robinhood Chain
    optionalNamespaces: { eip155: { chains: [RH_CAIP, "eip155:8453", "eip155:1"], methods: ["eth_sendTransaction", "personal_sign", "eth_signTypedData_v4"], events: ["chainChanged", "accountsChanged"] } },
  });
  await storage.commit();
  const approved = (async () => {
    try {
      const session = await withTimeout(approval(), 45000);
      const acct = session.namespaces.eip155?.accounts?.find((a) => a.includes(`:${RH}:`)) ?? session.namespaces.eip155?.accounts?.[0];
      const address = acct ? acct.split(":")[2] : "";
      await wcSet(sessNs(chatId), { topic: session.topic, address });
      await storage.commit();
      return address || null;
    } catch { await storage.commit(); return null; }
  })();
  return { uri: uri || "", approved };
}

export async function wcSession(chatId: number): Promise<{ topic: string; address: string } | null> {
  const s = (await wcGet(sessNs(chatId))) as { topic?: string; address?: string };
  return s?.topic && s?.address ? { topic: s.topic, address: s.address } : null;
}
export async function wcDisconnect(chatId: number): Promise<void> { await wcDel(sessNs(chatId)); await wcDel(kvNs(chatId)); }

async function request<T = unknown>(sc: InstanceType<typeof SignClient>, topic: string, method: string, params: unknown[]): Promise<T> {
  return withTimeout(sc.request<T>({ topic, chainId: RH_CAIP, request: { method, params } }), 45000);
}

// Fetch a quote from our own server-side proxy (same-origin guard allows no-Origin server calls).
async function quoteFor(sellSym: string, buySym: string, sellAmount: string, taker: string): Promise<Quote | { error: string }> {
  const sell = resolveToken(sellSym), buy = resolveToken(buySym);
  const q = new URLSearchParams({ sell_token: sell.address, buy_token: buy.address, sell_amount: sellAmount, taker, slippage_bps: "200" });
  try {
    const r = await fetch(`https://urizenfund.com/api/rialto/quote?${q.toString()}`, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) return { error: d?.error || "quote failed" };
    return d as Quote;
  } catch (e) { return { error: (e as Error).message }; }
}

export type WcSwapResult =
  | { status: "signed"; hash: string; out: string }
  | { status: "approved" }        // one-time approval sent; user re-runs to sign the swap
  | { status: "timeout" }
  | { status: "rejected" }
  | { status: "no-session" }
  | { status: "fallback"; reason: string } // can't do it over WC in one shot → use the app link
  | { status: "error"; error: string };

// Push a swap to the user's wallet. Single-tx path (native ETH, or already-approved token) signs in
// one interaction. If a one-time approval is needed, send that first and ask them to re-run (so each
// step stays within one serverless invocation). Permit2 quotes need two signatures → app fallback.
export async function wcSwap(chatId: number, sellSym: string, buySym: string, sellAmount: string): Promise<WcSwapResult> {
  const sess = await wcSession(chatId);
  if (!sess) return { status: "no-session" };
  const q = await quoteFor(sellSym, buySym, sellAmount, sess.address);
  if ("error" in q) return { status: "error", error: q.error };

  const payTok = resolveToken(sellSym);
  const storage = new DbStorage(kvNs(chatId));
  const sc = await initClient(storage);
  const from = sess.address;

  try {
    // ERC-20 (non-native) sells may need an allowance first
    if (!payTok.native) {
      if (q.permit2) return { status: "fallback", reason: "permit2" }; // two sigs — over the app link instead
      const spender = (q.issues?.allowance?.spender || q.tx.to) as `0x${string}`;
      const allowance = (await publicClient.readContract({ address: payTok.address as `0x${string}`, abi: erc20Abi, functionName: "allowance", args: [from as `0x${string}`, spender] })) as bigint;
      if (allowance < BigInt(q.sell_amount)) {
        const approveData = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, maxUint256] });
        await request<string>(sc, sess.topic, "eth_sendTransaction", [{ from, to: payTok.address, data: approveData }]);
        await storage.commit();
        return { status: "approved" };
      }
    }
    // send the swap
    const hash = await request<string>(sc, sess.topic, "eth_sendTransaction", [{
      from, to: q.tx.to, data: q.tx.data,
      ...(q.tx.value && q.tx.value !== "0" ? { value: `0x${BigInt(q.tx.value).toString(16)}` } : {}),
    }]);
    await storage.commit();
    const buyTok = resolveToken(buySym);
    const out = (Number(q.buy_amount) / 10 ** buyTok.decimals).toLocaleString(undefined, { maximumFractionDigits: 4 });
    return { status: "signed", hash: String(hash), out };
  } catch (e) {
    await storage.commit();
    return { status: (e as Error).message === "timeout" ? "timeout" : "rejected" };
  }
}
