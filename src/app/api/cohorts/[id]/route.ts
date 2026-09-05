import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { getModuleLockMap } from "@/lib/progress";

/**
 * GET /api/cohorts/[id] — a cohort's roster with each enrolled
 * trainee's progress, reusing the exact same completion computation
 * the trainee dashboard and course page already use (getModuleLockMap)
 * rather than inventing a second way to answer "how far along is this
 * trainee." One call per enrolled trainee — fine for a roster-sized
 * list (tens of trainees), not built for hundreds.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const cohort = await prisma.cohort.findUnique({
      where: { id: params.id },
      include: {
        course: { select: { id: true, title: true, createdById: true } },
        enrollments: {
          include: { trainee: { select: { id: true, name: true, email: true } } },
          orderBy: { enrolledAt: "asc" },
        },
      },
    });
    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found." }, { status: 404 });
    }
    await requireOwnedCourse(cohort.course.id, session.userId);

    const totalModules = await prisma.module.count({ where: { courseId: cohort.course.id } });

    const roster = await Promise.all(
      cohort.enrollments.map(async (e: { trainee: { id: string; name: string; email: string }; enrolledAt: Date }) => {
        const lockMap = await getModuleLockMap(cohort.course.id, e.trainee.id);
        const completedModules = Object.values(lockMap).filter((m) => m.completed).length;
        const certificate = await prisma.certificate.findUnique({
          where: { traineeId_courseId: { traineeId: e.trainee.id, courseId: cohort.course.id } },
          select: { code: true, revokedAt: true },
        });
        return {
          trainee: e.trainee,
          enrolledAt: e.enrolledAt,
          completedModules,
          totalModules,
          hasCertificate: !!certificate && !certificate.revokedAt,
          certificateCode: certificate?.revokedAt ? null : certificate?.code ?? null,
        };
      })
    );

    return NextResponse.json({
      id: cohort.id,
      name: cohort.name,
      startDate: cohort.startDate,
      endDate: cohort.endDate,
      course: { id: cohort.course.id, title: cohort.course.title },
      roster,
    });
  });
}
