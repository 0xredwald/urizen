import { verifyMessage } from "viem";
import { getWalletAgents, saveWalletAgent, deleteWalletAgent } from "@/lib/bot-store";

// Wallet-keyed agents (personas), shared between the app and the Telegram bot. The wallet is the
// account. READ is public by address (personas aren't secret). WRITE requires a wallet SIGNATURE over
// a fresh message — so only the wallet owner can change their agents. Storage is the same locked store.
export const runtime = "nodejs";

type InAgent = { id: string; data: { name?: string; mandate?: string; risk?: string; note?: string; instruments?: string[] } };

export async function GET(req: Request) {
  const address = (new URL(req.url).searchParams.get("address") || "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) return Response.json({ agents: [] });
  return Response.json({ agents: await getWalletAgents(address) });
}

export async function POST(req: Request) {
  let body: { address?: string; agents?: InAgent[]; activeId?: string; message?: string; signature?: `0x${string}` };
  try { body = await req.json(); } catch { return Response.json({ ok: false }, { status: 400 }); }
  const address = (body.address || "").toLowerCase();
  const { agents, activeId, message, signature } = body;
  if (!/^0x[a-f0-9]{40}$/.test(address) || !Array.isArray(agents) || !message || !signature) {
    return Response.json({ ok: false }, { status: 400 });
  }
  // the signed message carries a 13-digit timestamp — reject anything older than 10 minutes (replay guard)
  const ts = Number((message.match(/(\d{13})/) || [])[1] || 0);
  if (!ts || Math.abs(Date.now() - ts) > 10 * 60 * 1000) return Response.json({ ok: false, error: "stale" }, { status: 403 });
  let ok = false;
  try { ok = await verifyMessage({ address: address as `0x${string}`, message, signature }); } catch { /* */ }
  if (!ok) return Response.json({ ok: false, error: "bad signature" }, { status: 403 });

  // replace-all: drop agents removed on the app, upsert the rest, set the active one
  const existing = await getWalletAgents(address);
  const keep = new Set(agents.map((a) => a.id));
  for (const e of existing) if (!keep.has(e.id)) await deleteWalletAgent(address, e.id);
  for (const a of agents) await saveWalletAgent(address, a.id, a.data ?? {}, a.id === activeId);
  return Response.json({ ok: true });
}
