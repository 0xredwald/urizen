import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // heavy server-only SDK (used for CDP JWT auth in the x402 gate) — require at runtime, don't bundle
  serverExternalPackages: ["@coinbase/cdp-sdk"],
};

export default nextConfig;
