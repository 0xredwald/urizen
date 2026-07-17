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
  let data = quote.tx.data;

  if (quote.permit2 && !payTok.native) {
    const sellToken = payTok.address as `0x${string}`;
    onStatus?.("Checking approval…");
    const allowance = (await readContract(wagmiConfig, {
      address: sellToken, abi: erc20Abi, functionName: "allowance", args: [from as `0x${string}`, PERMIT2 as `0x${string}`], chainId: RH,
    })) as bigint;
    if (allowance < BigInt(quote.sell_amount)) {
      onStatus?.(`Approve ${paySym} (one-time)…`);
      const approveHash = await writeContract(wagmiConfig, {
        address: sellToken, abi: erc20Abi, functionName: "approve", args: [PERMIT2 as `0x${string}`, maxUint256], chainId: RH,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash, chainId: RH });
    }
    onStatus?.("Sign the swap…");
    const p = quote.permit2;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signature = await signTypedData(wagmiConfig, {
      domain: p.domain,
      types: permit2SignTypes(p),
      primaryType: p.primaryType,
      message: p.message,
    } as any);
    data = spliceSignature(quote.tx.data, signature, quote.tx.signature_offset);
  }

  onStatus?.("Confirm in your wallet…");
  return sendTransaction(wagmiConfig, {
    to: quote.tx.to as `0x${string}`,
    data: data as `0x${string}`,
    value: quote.tx.value && quote.tx.value !== "0" ? BigInt(quote.tx.value) : undefined,
    chainId: RH,
  });
}
