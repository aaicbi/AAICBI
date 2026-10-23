import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireCrmEmail } from "@/lib/crm/email";
import { recordAudit } from "@/lib/rbac/audit";
import { cleanSubject, sanitizeHtml, htmlToText, unknownFields, MERGE_FIELDS } from "@/lib/crm/emailCore";

export const dynamic = "force-dynamic";

/** GET — the templates (with the sender each one suggests and how many times it has been used). */
export async function GET() {
  return withApiErrors(async () => {
    const { access } = await requireCrmEmail("templates", "view");
    const rows = await prisma.emailTemplate.findMany({ orderBy: { name: "asc" }, include: { sender: { select: { name: true } } } });
    const used = await prisma.crmEmail.groupBy({ by: ["templateId"], where: { isTest: false, templateId: { not: null } }, _count: { _all: true } });
    const byId = new Map(used.map((u) => [u.templateId, u._count._all]));
    return NextResponse.json({
      canEdit: access.permissions.has("crm.templates:edit"), fields: MERGE_FIELDS.map((f) => ({ key: f.key, label: f.label })),
      templates: rows.map((t) => ({ id: t.id, key: t.key, name: t.name, description: t.description, category: t.category, subject: t.subject, body: t.body, version: t.version, active: t.active, senderId: t.senderId, senderName: t.sender?.name ?? null, updatedAt: t.updatedAt.toISOString(), used: byId.get(t.id) ?? 0 })),
    });
  });
}

const Content = { name: z.string().trim().min(2).max(80), description: z.string().trim().max(200).nullish(), category: z.enum(["SERVICE", "MARKETING"]), subject: z.string().max(400), body: z.string().max(60000), senderId: z.string().max(60).nullish(), active: z.boolean().optional() };
const Create = z.object({ action: z.literal("create"), ...Content });
const Update = z.object({ action: z.literal("update"), id: z.string().max(60), ...Content });

function checked(subject: string, body: string) {
  const subj = cleanSubject(subject), clean = sanitizeHtml(body);
  if (!subj) return { error: "Write a subject." };
  if (htmlToText(clean).length < 2) return { error: "Write a message." };
  const bad = unknownFields(subj + " " + clean);
  if (bad.length) return { error: `These fields do not exist: ${bad.map((b) => `{{${b}}}`).join(", ")}.` };
  return { subj, clean };
}

/** POST — create a template, or save changes to one (every save is a new version). */
export async function POST(req: Request) {
  return withApiErrors(async () => {
    const { session } = await requireCrmEmail("templates", "edit");
    const body = await req.json().catch(() => null);
    const c = Create.safeParse(body);
    const u = c.success ? null : Update.safeParse(body);
    const d = c.success ? c.data : u?.success ? u.data : null;
    if (!d) return NextResponse.json({ error: "That template was not understood." }, { status: 400 });
    const ok = checked(d.subject, d.body);
    if ("error" in ok) return NextResponse.json({ error: ok.error }, { status: 400 });
    if (d.senderId && !(await prisma.emailSender.findUnique({ where: { id: d.senderId }, select: { id: true } }))) return NextResponse.json({ error: "That sender does not exist." }, { status: 400 });
    if (d.action === "create") {
      const key = d.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "template";
      const taken = await prisma.emailTemplate.count({ where: { key: { startsWith: key } } });
      const row = await prisma.emailTemplate.create({ data: { key: taken ? `${key}_${taken + 1}` : key, name: d.name, description: d.description ?? null, category: d.category, subject: ok.subj, body: ok.clean, senderId: d.senderId ?? null, updatedById: session.userId, versions: { create: { version: 1, subject: ok.subj, body: ok.clean, createdById: session.userId } } } });
      await recordAudit({ actorId: session.userId, actorRole: session.role, action: "CRM_TEMPLATE_CREATED", resourceType: "template", resourceId: row.id });
      return NextResponse.json({ ok: true, id: row.id });
    }
    const before = await prisma.emailTemplate.findUnique({ where: { id: d.id } });
    if (!before) return NextResponse.json({ error: "Template not found." }, { status: 404 });
    const changed = before.subject !== ok.subj || before.body !== ok.clean;
    const version = changed ? before.version + 1 : before.version;
    await prisma.$transaction([
      prisma.emailTemplate.update({ where: { id: d.id }, data: { name: d.name, description: d.description ?? null, category: d.category, subject: ok.subj, body: ok.clean, senderId: d.senderId ?? null, active: d.active ?? before.active, version, updatedById: session.userId } }),
      ...(changed ? [prisma.emailTemplateVersion.create({ data: { templateId: d.id, version, subject: ok.subj, body: ok.clean, createdById: session.userId } })] : []),
    ]);
    await recordAudit({ actorId: session.userId, actorRole: session.role, action: "CRM_TEMPLATE_CHANGED", resourceType: "template", resourceId: d.id, after: { version } });
    return NextResponse.json({ ok: true, version });
  });
}
