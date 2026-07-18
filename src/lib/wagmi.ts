import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, coinbaseWallet, walletConnectWallet, rainbowWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
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

// WalletConnect project id — set NEXT_PUBLIC_WC_PROJECT_ID (free from cloud.reown.com) to enable
// mobile / WalletConnect wallets. WITHOUT a real id, WalletConnect 403s (the "urizen_alpha_default"
// placeholder), so we omit WC entirely and rely on injected wallets (browser extension / in-app
// browser), which need no project id and are the reliable path.
export const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "urizen_alpha_default";
export const hasRealWc = projectId !== "urizen_alpha_default" && projectId.length > 10;

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      // injectedWallet is pure window.ethereum — no WalletConnect dependency, works in extensions and
      // most in-app browsers. metaMask/coinbase fall back to injected on desktop.
      wallets: [injectedWallet, metaMaskWallet, coinbaseWallet, ...(hasRealWc ? [rainbowWallet, walletConnectWallet] : [])],
    },
  ],
  { appName: "Urizen", projectId },
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [robinhoodChain, base], // Base is needed to sign x402 (USDC) payments
  transports: { [robinhoodChain.id]: http(), [base.id]: http() },
  ssr: true,
});
