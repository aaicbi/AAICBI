import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";

const GrantSchema = z.object({ email: z.string().email() });

/**
 * GET/POST /api/courses/[id]/enrollments — the admin-granted half of
 * M19's free-and-admin-granted enrollment scope; the free self-enroll
 * path already lives at POST /api/courses/[id]/enroll. Genuinely
 * different from that route, not a duplicate: this one works for ANY
 * course, free or paid — the whole point of an admin grant is being
 * able to bypass payment when appropriate (a scholarship, a support
 * gesture), which the free-only self-enroll path deliberately can't.
 *
 * By email, not trainee id, same reasoning as the cohort-enrollment
 * route this mirrors: that's what a staff member actually has on
 * hand — a roster, a registration form — not an internal database id.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, session.userId);

    const enrollments = await prisma.courseEnrollment.findMany({
      where: { courseId: params.id },
      orderBy: { enrolledAt: "desc" },
      include: {
        trainee: { select: { id: true, name: true, email: true } },
        enrolledBy: { select: { name: true } },
      },
    });
    return NextResponse.json(enrollments);
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, session.userId);

    const body = await req.json();
    const parsed = GrantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const trainee = await prisma.trainee.findUnique({ where: { email: parsed.data.email } });
    if (!trainee) {
      return NextResponse.json({ error: "No trainee account found with that email." }, { status: 404 });
    }

    const existing = await prisma.courseEnrollment.findUnique({
      where: { traineeId_courseId: { traineeId: trainee.id, courseId: params.id } },
    });
    if (existing) {
      if (existing.accessRevokedAt === null) {
        return NextResponse.json({ error: "This trainee already has access to this course." }, { status: 409 });
      }
      // A previously-revoked trainee — re-granting is a genuine,
      // deliberate staff action here (unlike the free self-enroll
      // route, which refuses to silently undo a revocation), so this
      // updates the existing row back to active rather than trying
      // (and failing) to create a second one for the same pair.
      const reactivated = await prisma.courseEnrollment.update({
        where: { id: existing.id },
        data: { source: "ADMIN_GRANTED", enrolledById: session.userId, accessRevokedAt: null, unlockedAt: new Date() },
        include: { trainee: { select: { id: true, name: true, email: true } } },
      });
      return NextResponse.json(reactivated, { status: 200 });
    }

    const enrollment = await prisma.courseEnrollment.create({
      data: {
        courseId: params.id,
        traineeId: trainee.id,
        source: "ADMIN_GRANTED",
        enrolledById: session.userId,
        unlockedAt: new Date(),
      },
      include: { trainee: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json(enrollment, { status: 201 });
  });
}
