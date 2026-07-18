import { verifyTgLink, setWallet } from "@/lib/bot-store";

// The connect page calls this after a wallet connects, when it was opened from the bot with a signed
// `tg` param — it records which wallet belongs to which chat so the bot can DETECT the connection.
// Signature-guarded: the page can't link an arbitrary chat to a wallet without the per-chat signature.
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { tg?: number | string; address?: string; sig?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false }, { status: 400 }); }
  const tg = Number(body.tg);
  const address = (body.address || "").toLowerCase();
  const sig = body.sig || "";
  if (!tg || !/^0x[a-f0-9]{40}$/.test(address) || !verifyTgLink(tg, sig)) {
    return Response.json({ ok: false }, { status: 403 });
  }

  await setWallet(tg, address);

  // confirm in the chat so the user sees it landed
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: tg, parse_mode: "HTML", disable_web_page_preview: true,
          text: `🔗 <b>Wallet connected</b> · <code>${address.slice(0, 6)}…${address.slice(-4)}</code>. You're set to trade — non-custodial, you sign every trade yourself.`,
        }),
      });
    } catch { /* best effort */ }
  }
  return Response.json({ ok: true });
}
