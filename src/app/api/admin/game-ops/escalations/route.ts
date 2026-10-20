import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/rbac/audit";
import { withApiErrors } from "@/lib/apiError";
import { cleanReason } from "@/lib/orggames/core";

export const dynamic = "force-dynamic";

/** GET — incidents training organizations escalated to AAICBI, open first. Needs "Incidents and escalations: View". */
export async function GET() {
  return withApiErrors(async () => {
    await requirePermission("gaming_ops.incidents:view");
    const rows = await prisma.gameModerationAction.findMany({ where: { kind: "ESCALATED" }, orderBy: [{ resolvedAt: "asc" }, { createdAt: "desc" }], take: 60 });
    const orgs = new Map((await prisma.trainingOrganization.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.organizationId))] } }, select: { id: true, name: true } })).map((o) => [o.id, o.name]));
    const people = new Map((await prisma.trainee.findMany({ where: { id: { in: rows.map((r) => r.traineeId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
    const courses = new Map((await prisma.course.findMany({ where: { id: { in: rows.map((r) => r.courseId).filter((x): x is string => !!x) } }, select: { id: true, title: true } })).map((c) => [c.id, c.title]));
    return NextResponse.json({ items: rows.map((r) => ({ id: r.id, organization: orgs.get(r.organizationId) ?? "An organization", course: r.courseId ? courses.get(r.courseId) ?? null : null, trainee: r.traineeId ? people.get(r.traineeId) ?? "A trainee" : null, reason: r.reason, by: r.actorName, at: r.createdAt.getTime(), resolved: r.resolvedAt !== null })) }, { headers: { "Cache-Control": "no-store" } });
  });
}

const Body = z.object({ id: z.string().min(1).max(80), note: z.string().max(600) });

/** POST — close an escalated incident with a note. Needs "Incidents and escalations: Manage". */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const { session } = await requirePermission("gaming_ops.incidents:manage");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    const n = cleanReason(parsed.data.note);
    if (!n.ok) return NextResponse.json({ error: n.error }, { status: 400 });
    const row = await prisma.gameModerationAction.findFirst({ where: { id: parsed.data.id, kind: "ESCALATED", resolvedAt: null } });
    if (!row) return NextResponse.json({ error: "That incident could not be found or is already closed." }, { status: 404 });
    await prisma.gameModerationAction.update({ where: { id: row.id }, data: { resolvedAt: new Date(), resolvedById: session.userId } });
    await recordAudit({ actorId: session.userId, actorRole: session.role, action: "GAME_ESCALATION_CLOSED", resourceType: "game_moderation", resourceId: row.id, organizationId: row.organizationId, reason: n.reason });
    return NextResponse.json({ ok: true });
  });
}
