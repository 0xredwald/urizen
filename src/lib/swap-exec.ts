// The single swap executor — used by the trade dock and the agent's swap-proposal cards.
// Handles Rialto's Permit2 settlement for ERC-20 sells: approve Permit2 once, sign the order,
// splice the signature into the calldata, send. Native-ETH sells skip all of that.

import { readContract, writeContract, waitForTransactionReceipt, signTypedData, sendTransaction, switchChain, getChainId } from "@wagmi/core";
import { erc20Abi, maxUint256 } from "viem";
import { wagmiConfig } from "./wagmi";
import { resolveToken, spliceSignature, permit2SignTypes, PERMIT2, type Quote } from "./rialto";

const RH = 4663;

export async function executeSwap(quote: Quote, from: string, paySym: string, onStatus?: (s: string) => void): Promise<`0x${string}`> {
  if (quote.chain_id && quote.chain_id !== RH) throw new Error(`quote chain mismatch (${quote.chain_id} ≠ ${RH})`);
  if (getChainId(wagmiConfig) !== RH) await switchChain(wagmiConfig, { chainId: RH });

  const payTok = resolveToken(paySym);
  const sellToken = payTok.address as `0x${string}`;
  let data = quote.tx.data;

  // Ensure a max ERC-20 approval to `spender` exists (one-time per token). No-op for native sells.
  const ensureApproval = async (spender: `0x${string}`) => {
    if (payTok.native) return;
    onStatus?.("Checking approval…");
    const allowance = (await readContract(wagmiConfig, {
      address: sellToken, abi: erc20Abi, functionName: "allowance", args: [from as `0x${string}`, spender], chainId: RH,
    })) as bigint;
    if (allowance < BigInt(quote.sell_amount)) {
      onStatus?.(`Approve ${paySym} (one-time)…`);
      const approveHash = await writeContract(wagmiConfig, {
        address: sellToken, abi: erc20Abi, functionName: "approve", args: [spender, maxUint256], chainId: RH,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash, chainId: RH });
    }
  };

  if (quote.permit2 && !payTok.native) {
    // Permit2 settlement: approve Permit2 once, then sign the order per swap (2 interactions after the
    // one-time approval). Kept as a fallback if Rialto returns a permit2 quote.
    await ensureApproval(PERMIT2 as `0x${string}`);
    onStatus?.("Sign the swap…");
    const p = quote.permit2;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signature = await signTypedData(wagmiConfig, { domain: p.domain, types: permit2SignTypes(p), primaryType: p.primaryType, message: p.message } as any);
    data = spliceSignature(quote.tx.data, signature, quote.tx.signature_offset);
  } else if (!payTok.native) {
    // Allowance settlement: approve the router ONCE (max), then every swap is a single transaction —
    // no per-swap signature. This is the smooth path (fixes "had to sign multiple times").
    const spender = (quote.issues?.allowance?.spender || quote.tx.to) as `0x${string}`;
    await ensureApproval(spender);
  }

  onStatus?.("Confirm in your wallet…");
  return sendTransaction(wagmiConfig, {
    to: quote.tx.to as `0x${string}`,
    data: data as `0x${string}`,
    value: quote.tx.value && quote.tx.value !== "0" ? BigInt(quote.tx.value) : undefined,
    chainId: RH,
  });
}
