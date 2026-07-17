// Base URL for calling our own internal API routes. Empty on the client (relative fetch works),
// absolute on the server (Node/edge has no origin) so server contexts — the Telegram bot, the
// x402 endpoint — can call the same /api/* routes over HTTP.
export const apiBase = (): string =>
  typeof window === "undefined" ? (process.env.NEXT_PUBLIC_SITE_URL || "https://urizenfund.com") : "";
