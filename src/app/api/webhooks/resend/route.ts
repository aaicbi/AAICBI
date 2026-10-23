import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { verifyWebhook } from "@/lib/crm/emailCore";
import { applyResendEvent, type ResendEvent } from "@/lib/crm/email";

export const dynamic = "force-dynamic";

/**
 * POST — Resend's delivery reports (sent, delivered, delayed, bounced, complained, opened, clicked). Only a body signed with RESEND_WEBHOOK_SECRET
 * is believed. Reports for emails this system did not send are accepted and ignored. Safe to receive twice.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: "Delivery reports are not set up: RESEND_WEBHOOK_SECRET is missing." }, { status: 503 });
    const body = await req.text();
    const id = req.headers.get("svix-id");
    if (!verifyWebhook({ id, timestamp: req.headers.get("svix-timestamp"), signatureHeader: req.headers.get("svix-signature"), body, secret })) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    let payload: ResendEvent;
    try { payload = JSON.parse(body) as ResendEvent; } catch { return NextResponse.json({ error: "Bad body." }, { status: 400 }); }
    return NextResponse.json({ result: await applyResendEvent(id as string, payload) });
  });
}
