import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { base } from "viem/chains";

// Robinhood Chain (4663) as a first-class wagmi chain — proper id, RPC, native currency + explorer.
export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
});

// WalletConnect project id — set NEXT_PUBLIC_WC_PROJECT_ID to enable mobile/WC wallets.
// Injected wallets (MetaMask, Rabby, Phantom, Coinbase extension) work without it.
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "urizen_alpha_default";

export const wagmiConfig = getDefaultConfig({
  appName: "Urizen",
  projectId,
  chains: [robinhoodChain, base], // Base is needed to sign x402 (USDC) payments
  ssr: true,
});
