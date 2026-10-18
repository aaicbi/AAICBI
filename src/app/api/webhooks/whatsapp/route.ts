import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { applyWebhook } from "@/lib/growth/messaging";
import { parseWhatsAppWebhook, signatureValid } from "@/lib/growth/messagingCore";

export const dynamic = "force-dynamic";

/** GET — Meta's one-time check when the webhook is registered: answer with its challenge if the verify token matches ours. */
export async function GET(req: NextRequest) {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  const q = req.nextUrl.searchParams;
  if (expected && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === expected) {
    return new NextResponse(q.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST — delivery receipts (sent, delivered, read, failed) and replies from WhatsApp. A reply of STOP (or unsubscribe, cancel...) opts
 * that number out of every message. The body is only trusted when Meta's signature on it checks out against WHATSAPP_APP_SECRET.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });
    const raw = await req.text();
    if (!signatureValid(raw, req.headers.get("x-hub-signature-256"), secret)) return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    let payload: unknown = null;
    try { payload = JSON.parse(raw); } catch { /* an unreadable body changes nothing */ }
    const r = await applyWebhook(parseWhatsAppWebhook(payload));
    return NextResponse.json({ ok: true, ...r });
  });
}
