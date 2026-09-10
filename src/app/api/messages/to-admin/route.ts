import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { notifyByEmail } from "@/lib/notifications/log";

/**
 * POST /api/messages/to-admin — the simple direct inbox, reverse
 * direction of Loop broadcast messaging. Any signed-in trainee,
 * employer, or non-Super-Admin staff member (ADMIN/INSTRUCTOR) can send
 * a message straight to every Super Admin. SUPER_ADMIN is deliberately
 * excluded from the allowed roles below — a Super Admin has no reason
 * to message themselves.
 *
 * Deliberately no AI anywhere in this file, unlike Loop's own outbound
 * path — see SuperAdminMessage's schema comment for why routing raw
 * user-typed text through Claude here would be a new, unnecessary risk.
 * This is a plain create-and-notify route, the same shape as
 * POST /api/profile-reports.
 *
 * senderType/senderId always come from the session, never the request
 * body — the same "never trust an id from the caller" rule every other
 * route in this app applies. senderName/senderEmail are looked up
 * fresh from the sender's own account record (never client-supplied)
 * and snapshotted onto the message so it stays legible later.
 */
const MessageSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

async function resolveSender(
  session: Awaited<ReturnType<typeof requireRole>>
): Promise<{ senderType: "TRAINEE" | "STAFF" | "EMPLOYER"; name: string; email: string }> {
  if (session.role === "TRAINEE") {
    const t = await prisma.trainee.findUnique({ where: { id: session.userId }, select: { name: true, email: true } });
    return { senderType: "TRAINEE", name: t?.name ?? "A trainee", email: t?.email ?? session.email };
  }
  if (session.role === "EMPLOYER") {
    const e = await prisma.employer.findUnique({ where: { id: session.userId }, select: { companyName: true, email: true } });
    return { senderType: "EMPLOYER", name: e?.companyName ?? "An employer", email: e?.email ?? session.email };
  }
  const u = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } });
  return { senderType: "STAFF", name: u?.name ?? "A staff member", email: u?.email ?? session.email };
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE", "EMPLOYER", "ADMIN", "INSTRUCTOR");

    const limited = await rateLimit(`message-to-admin:${session.userId}:${clientIp(req)}`, 5, 15 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many messages sent in a short time. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = MessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "A subject and message are required." }, { status: 400 });
    }

    const sender = await resolveSender(session);

    const message = await prisma.superAdminMessage.create({
      data: {
        senderType: sender.senderType,
        senderId: session.userId,
        senderName: sender.name,
        senderEmail: sender.email,
        subject: parsed.data.subject,
        body: parsed.data.body,
      },
    });

    const superAdmins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true, email: true } });
    for (const admin of superAdmins) {
      await notifyByEmail({
        recipientType: "STAFF",
        recipientId: admin.id,
        to: admin.email,
        type: "MESSAGE_TO_ADMIN",
        relatedId: message.id,
        url: "/admin/inbox",
        subject: `New message from ${sender.name}: ${parsed.data.subject}`,
        html: `<p><strong>From:</strong> ${escapeHtml(sender.name)} (${escapeHtml(sender.email)})</p><p>${escapeHtml(parsed.data.body).replace(/\n/g, "<br>")}</p>`,
        text: `From: ${sender.name} (${sender.email})\n\n${parsed.data.body}`,
      }).catch((e) => console.error(`Failed to notify Super Admin ${admin.id} of a new inbox message:`, e));
    }

    return NextResponse.json({ id: message.id }, { status: 201 });
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
