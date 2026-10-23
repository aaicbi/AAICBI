import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { appUrl } from "@/lib/appUrl";
import { requireRole } from "@/lib/auth/session";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { recordAudit } from "@/lib/rbac/audit";
import { registrationState } from "@/lib/crm/registrationCore";

export const dynamic = "force-dynamic";

async function card(courseId: string) {
  const c = await prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { id: true, status: true, registrationEnabled: true, capacity: true, startDate: true, endDate: true, registrationDeadline: true, lifecyclePhaseOverride: true } });
  const registered = await prisma.courseRegistration.count({ where: { courseId, stage: { not: "WITHDRAWN" } } });
  const state = registrationState(c, registered);
  return { enabled: c.registrationEnabled, open: state.open, reason: state.open ? null : state.reason, registered, link: appUrl(`/register/${c.id}`), qrHint: appUrl(`/register/${c.id}?src=qr`) };
}

/** GET — the course's registration page: whether it is switched on, whether it is open right now, its link and how many registered. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, session.userId, session.role);
    return NextResponse.json(await card(params.id));
  });
}

/** PATCH { enabled } — open or close the registration page for a course that is not already a scheduled "coming soon" course. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, session.userId, session.role);
    const parsed = z.object({ enabled: z.boolean() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That change was not understood." }, { status: 400 });
    await prisma.course.update({ where: { id: params.id }, data: { registrationEnabled: parsed.data.enabled } });
    await recordAudit({ actorId: session.userId, actorRole: session.role, action: parsed.data.enabled ? "COURSE_REGISTRATION_ON" : "COURSE_REGISTRATION_OFF", resourceType: "course", resourceId: params.id });
    return NextResponse.json(await card(params.id));
  });
}
