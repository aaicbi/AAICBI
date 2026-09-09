import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";

const ExtendSchema = z.object({
  days: z.number().int().positive().max(3650),
  reason: z.string().trim().min(1, "A reason is required."),
});

/**
 * POST /api/courses/[id]/enrollments/[enrollmentId]/extend — the
 * course enrollment/subscription system's manual access-extension
 * action (task Section 22). Same ownership discipline as the sibling
 * revoke route right next to this one: `requireOwnedCourse`, 404 (not
 * 403) for a course this staff member doesn't own — never confirm a
 * course's existence to someone with no business seeing it.
 *
 * `reason` is mandatory, not optional — same "no untracked backdoor"
 * standard this codebase already applies to CooldownOverride/
 * AiCreditGrant, per this milestone's own security checklist. Every
 * call writes a real, permanent `AccessExtension` row alongside the
 * enrollment update, in one transaction — never a silent field flip
 * with no trace of who did it or why.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string; enrollmentId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, session.userId);

    const enrollment = await prisma.courseEnrollment.findUnique({ where: { id: params.enrollmentId } });
    if (!enrollment || enrollment.courseId !== params.id) {
      return NextResponse.json({ error: "Enrollment not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = ExtendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Extends from whichever is later: the existing currentPeriodEnd
    // (a still-active or not-yet-lapsed subscription keeps its
    // remaining time, extension is added on top) or now (a genuinely
    // lapsed/never-set enrollment starts counting from today, not from
    // some date already in the past). Mirrors how a real support
    // gesture — "add 30 days" — should behave regardless of exactly
    // when access happened to expire.
    const base = enrollment.currentPeriodEnd && enrollment.currentPeriodEnd > new Date() ? enrollment.currentPeriodEnd : new Date();
    const newPeriodEnd = new Date(base);
    newPeriodEnd.setDate(newPeriodEnd.getDate() + parsed.data.days);

    const [updated] = await prisma.$transaction([
      prisma.courseEnrollment.update({
        where: { id: params.enrollmentId },
        data: { currentPeriodEnd: newPeriodEnd, accessRevokedAt: null },
        include: { trainee: { select: { id: true, name: true, email: true } } },
      }),
      prisma.accessExtension.create({
        data: {
          enrollmentId: params.enrollmentId,
          extendedById: session.userId,
          previousPeriodEnd: enrollment.currentPeriodEnd,
          newPeriodEnd,
          reason: parsed.data.reason,
        },
      }),
    ]);

    return NextResponse.json(updated);
  });
}
