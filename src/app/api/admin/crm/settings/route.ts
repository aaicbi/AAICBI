import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requirePermission } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/rbac/audit";

export const dynamic = "force-dynamic";

/** GET — the organizations with their CRM switch, and the agreement versions. */
export async function GET() {
  return withApiErrors(async () => {
    const { access } = await requirePermission("crm.agreement:view");
    const canSwitch = access.permissions.has("crm.settings:configure");
    const [orgs, agreements, counts] = await Promise.all([
      canSwitch ? prisma.trainingOrganization.findMany({ where: { approvalState: "APPROVED" }, orderBy: { name: "asc" }, select: { id: true, name: true, crmEnabled: true } }) : Promise.resolve([]),
      prisma.registrationAgreement.findMany({ orderBy: { version: "desc" }, take: 10, select: { id: true, version: true, title: true, body: true, active: true, createdAt: true, _count: { select: { registrations: true } } } }),
      prisma.courseRegistration.groupBy({ by: ["organizationId"], _count: { _all: true } }),
    ]);
    const byOrg = new Map(counts.map((c) => [c.organizationId, c._count._all]));
    return NextResponse.json({
      canSwitch, canEditAgreement: access.permissions.has("crm.agreement:edit"),
      platformRegistrations: byOrg.get(null) ?? 0,
      organizations: orgs.map((o) => ({ id: o.id, name: o.name, enabled: o.crmEnabled, registrations: byOrg.get(o.id) ?? 0 })),
      agreements: agreements.map((a) => ({ id: a.id, version: a.version, title: a.title, body: a.body, active: a.active, createdAt: a.createdAt.toISOString(), signed: a._count.registrations })),
    });
  });
}

const Switch = z.object({ action: z.literal("switch"), organizationId: z.string().max(60), enabled: z.boolean() });
const Agreement = z.object({ action: z.literal("agreement"), title: z.string().trim().min(3).max(120), body: z.string().trim().min(100, "The agreement should be at least a few sentences.").max(12000) });

/** POST — switch the CRM on or off for an organization, or publish a new version of the agreement. */
export async function POST(req: Request) {
  return withApiErrors(async () => {
    const body = await req.json().catch(() => null);
    const sw = Switch.safeParse(body);
    if (sw.success) {
      const { session } = await requirePermission("crm.settings:configure");
      const org = await prisma.trainingOrganization.findUnique({ where: { id: sw.data.organizationId }, select: { id: true, crmEnabled: true } });
      if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });
      await prisma.trainingOrganization.update({ where: { id: org.id }, data: { crmEnabled: sw.data.enabled } });
      await recordAudit({ actorId: session.userId, actorRole: session.role, action: sw.data.enabled ? "CRM_ENABLED" : "CRM_DISABLED", resourceType: "organization", resourceId: org.id, organizationId: org.id, before: { crmEnabled: org.crmEnabled }, after: { crmEnabled: sw.data.enabled } });
      return NextResponse.json({ ok: true });
    }
    const ag = Agreement.safeParse(body);
    if (ag.success) {
      const { session } = await requirePermission("crm.agreement:edit");
      const last = await prisma.registrationAgreement.findFirst({ orderBy: { version: "desc" }, select: { version: true } });
      const version = (last?.version ?? 0) + 1;
      await prisma.$transaction([
        prisma.registrationAgreement.updateMany({ where: { active: true }, data: { active: false } }),
        prisma.registrationAgreement.create({ data: { version, title: ag.data.title, body: ag.data.body, active: true, createdById: session.userId } }),
      ]);
      await recordAudit({ actorId: session.userId, actorRole: session.role, action: "CRM_AGREEMENT_PUBLISHED", resourceType: "agreement", resourceId: String(version), after: { version } });
      return NextResponse.json({ ok: true, version });
    }
    const first = [...(sw.error?.issues ?? []), ...(ag.error?.issues ?? [])].find((i) => i.message && i.code === "too_small");
    return NextResponse.json({ error: first?.message ?? "That change was not understood." }, { status: 400 });
  });
}
