import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireCrmEmail } from "@/lib/crm/email";
import { recordAudit } from "@/lib/rbac/audit";

export const dynamic = "force-dynamic";

/** GET — the approved senders. */
export async function GET() {
  return withApiErrors(async () => {
    const { access } = await requireCrmEmail("senders", "view");
    const rows = await prisma.emailSender.findMany({ orderBy: [{ stream: "asc" }, { name: "asc" }], include: { _count: { select: { emails: true } } } });
    return NextResponse.json({ canManage: access.permissions.has("crm.senders:manage"), senders: rows.map((r) => ({ id: r.id, name: r.name, fromAddress: r.fromAddress, replyTo: r.replyTo, stream: r.stream, verified: r.verified, active: r.active, allowOrganizations: r.allowOrganizations, sent: r._count.emails })) });
  });
}

const EMAIL = z.string().trim().toLowerCase().email().max(160);
const Create = z.object({ action: z.literal("create"), name: z.string().trim().min(2).max(80), fromAddress: EMAIL, replyTo: EMAIL.nullish(), stream: z.enum(["SERVICE", "MARKETING"]) });
const Update = z.object({ action: z.literal("update"), id: z.string().max(60), name: z.string().trim().min(2).max(80).optional(), replyTo: EMAIL.nullable().optional(), verified: z.boolean().optional(), active: z.boolean().optional(), allowOrganizations: z.boolean().optional() });

/** POST — add a sender, or change one. "Verified" is the Super Admin's confirmation that the domain is verified in Resend: nothing is sent from a sender until it is on. */
export async function POST(req: Request) {
  return withApiErrors(async () => {
    const { session } = await requireCrmEmail("senders", "manage");
    const body = await req.json().catch(() => null);
    const c = Create.safeParse(body);
    if (c.success) {
      if (await prisma.emailSender.findUnique({ where: { fromAddress: c.data.fromAddress } })) return NextResponse.json({ error: "That address is already a sender." }, { status: 409 });
      const row = await prisma.emailSender.create({ data: { name: c.data.name, fromAddress: c.data.fromAddress, replyTo: c.data.replyTo ?? null, stream: c.data.stream } });
      await recordAudit({ actorId: session.userId, actorRole: session.role, action: "CRM_SENDER_ADDED", resourceType: "sender", resourceId: row.id, after: { fromAddress: row.fromAddress, stream: row.stream } });
      return NextResponse.json({ ok: true, id: row.id });
    }
    const u = Update.safeParse(body);
    if (!u.success) return NextResponse.json({ error: "That change was not understood." }, { status: 400 });
    const before = await prisma.emailSender.findUnique({ where: { id: u.data.id } });
    if (!before) return NextResponse.json({ error: "Sender not found." }, { status: 404 });
    const { action: _a, id, ...patch } = u.data;
    void _a;
    await prisma.emailSender.update({ where: { id }, data: patch });
    await recordAudit({ actorId: session.userId, actorRole: session.role, action: "CRM_SENDER_CHANGED", resourceType: "sender", resourceId: id, before: { verified: before.verified, active: before.active, replyTo: before.replyTo }, after: patch });
    return NextResponse.json({ ok: true });
  });
}
