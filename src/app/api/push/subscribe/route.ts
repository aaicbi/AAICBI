import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rateLimit";
import { resolveNotificationRecipient } from "@/lib/notifications/recipientScope";
import { MAX_SUBSCRIPTIONS_PER_ACCOUNT, SubscriptionSchema, UnsubscribeSchema } from "@/lib/push/core";
import { pushIsConfigured } from "@/lib/push/send";

export const dynamic = "force-dynamic";

function unauthenticated() {
  return NextResponse.json({ error: "Please sign in." }, { status: 401 });
}

/** GET /api/push/subscribe — whether push is available, the public key the browser needs, and how many devices this account has. */
export async function GET() {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session) return unauthenticated();
    const who = await resolveNotificationRecipient(session);
    const devices = pushIsConfigured() ? await prisma.pushSubscription.count({ where: who }) : 0;
    return NextResponse.json({ configured: pushIsConfigured(), publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null, devices });
  });
}

/** POST /api/push/subscribe — this browser agrees to push notifications for the signed-in account. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session) return unauthenticated();
    if (!pushIsConfigured()) return NextResponse.json({ error: "Push notifications are not switched on for the platform yet." }, { status: 503 });
    const limited = await rateLimit(`push-subscribe:${session.userId}`, 20, 60 * 60 * 1000);
    if (!limited.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    const parsed = SubscriptionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That subscription is not valid." }, { status: 400 });

    const who = await resolveNotificationRecipient(session);
    const existing = await prisma.pushSubscription.count({ where: who });
    const owned = await prisma.pushSubscription.findUnique({ where: { endpoint: parsed.data.endpoint }, select: { id: true } });
    if (!owned && existing >= MAX_SUBSCRIPTIONS_PER_ACCOUNT) {
      return NextResponse.json({ error: "This account has reached its limit of devices. Turn notifications off on one you no longer use." }, { status: 409 });
    }
    // The endpoint is unique to a browser; if someone else signed in on it before, it now belongs to the current account.
    await prisma.pushSubscription.upsert({
      where: { endpoint: parsed.data.endpoint },
      create: { ...who, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, userAgent: (req.headers.get("user-agent") ?? "").slice(0, 200) },
      update: { ...who, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, lastUsedAt: new Date() },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}

/** DELETE /api/push/subscribe — this browser stops receiving push notifications (only its own subscription for this account). */
export async function DELETE(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session) return unauthenticated();
    const parsed = UnsubscribeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const who = await resolveNotificationRecipient(session);
    await prisma.pushSubscription.deleteMany({ where: { ...who, endpoint: parsed.data.endpoint } });
    return NextResponse.json({ ok: true });
  });
}
