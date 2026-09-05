import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getModuleLockMap } from "@/lib/progress";

/**
 * GET /api/trainee/progress — powers the trainee dashboard's "Continue
 * Learning" list: every course this trainee has actually started (an
 * attempt or a completed lesson somewhere in it), with a percent-
 * complete and when they were last active in it, most-recent-first.
 *
 * Deliberately NOT every published course — M10's "no enrollment"
 * design means a trainee can browse anything, but the dashboard should
 * reflect what they're actually doing, not the entire catalog (that's
 * what /trainee/courses is for).
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const [attemptActivity, lessonActivity] = await Promise.all([
      prisma.attempt.findMany({
        where: { traineeId: session.userId, exam: { courseModule: { isNot: null } } },
        select: { startedAt: true, exam: { select: { courseModule: { select: { courseId: true } } } } },
      }),
      prisma.lessonProgress.findMany({
        where: { traineeId: session.userId },
        select: { completedAt: true, lesson: { select: { module: { select: { courseId: true } } } } },
      }),
    ]);

    const lastActivityByCourseId = new Map<string, Date>();
    for (const a of attemptActivity) {
      const courseId = a.exam.courseModule?.courseId;
      if (!courseId) continue;
      const existing = lastActivityByCourseId.get(courseId);
      if (!existing || a.startedAt > existing) lastActivityByCourseId.set(courseId, a.startedAt);
    }
    for (const l of lessonActivity) {
      const courseId = l.lesson.module.courseId;
      const existing = lastActivityByCourseId.get(courseId);
      if (!existing || l.completedAt > existing) lastActivityByCourseId.set(courseId, l.completedAt);
    }

    const courseIds = [...lastActivityByCourseId.keys()];
    if (courseIds.length === 0) {
      return NextResponse.json({ courses: [] });
    }

    const courses = await prisma.course.findMany({
      // M12 audit finding: this used to fetch by id alone, with no
      // `published` filter — a course a trainee had real activity in
      // could later be unpublished by staff and would still show up
      // here, linking to a course page that now 404s for them (the
      // course GET route already blocks an unpublished course for
      // anyone but its owner). Filtering here means the dashboard
      // never advertises a link that's guaranteed to fail.
      where: { id: { in: courseIds }, published: true },
      select: { id: true, title: true, modules: { select: { id: true } } },
    });

    const results = await Promise.all(
      courses.map(async (course: { id: string; title: string; modules: { id: string }[] }) => {
        const lockMap = await getModuleLockMap(course.id, session.userId);
        const totalModules = course.modules.length;
        const completedModules = Object.values(lockMap).filter((m) => m.completed).length;
        return {
          courseId: course.id,
          courseTitle: course.title,
          totalModules,
          completedModules,
          percentComplete: totalModules === 0 ? 0 : Math.round((completedModules / totalModules) * 100),
          lastActivityAt: lastActivityByCourseId.get(course.id),
        };
      })
    );

    results.sort((a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0));

    return NextResponse.json({ courses: results });
  });
}
