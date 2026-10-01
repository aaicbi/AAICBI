import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { computeStreakDays } from "@/lib/analytics/streakCore";

const STREAK_LOOKBACK_DAYS = 60;
const EXPLORED_LOOKBACK_DAYS = 30;
const MAX_EXPLORED_COURSES = 5;

/**
 * GET /api/trainee/my-activity — "Your Learning Activity" (task Section
 * 24). Entirely the trainee's own data, about themselves — no new
 * privacy surface, and a good end-to-end validation of the same
 * underlying tables the admin dashboard aggregates across everyone.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const traineeId = session.userId;

    const [coursesStarted, coursesCompleted, lessonsCompleted, assessmentsCompleted, recentEvents, exploredCourseRows] =
      await Promise.all([
        prisma.courseEnrollment.count({ where: { traineeId, unlockedAt: { not: null } } }),
        prisma.courseEnrollment.count({ where: { traineeId, completedAt: { not: null } } }),
        prisma.lessonProgress.count({ where: { traineeId } }),
        prisma.attempt.count({ where: { traineeId, status: "SUBMITTED" } }),
        prisma.analyticsEvent.findMany({
          where: { userId: traineeId, recipientType: "TRAINEE", createdAt: { gte: new Date(Date.now() - STREAK_LOOKBACK_DAYS * 86400000) } },
          select: { createdAt: true },
        }),
        prisma.analyticsEvent.findMany({
          where: {
            userId: traineeId,
            recipientType: "TRAINEE",
            type: "COURSE_VIEWED",
            courseId: { not: null },
            createdAt: { gte: new Date(Date.now() - EXPLORED_LOOKBACK_DAYS * 86400000) },
          },
          select: { courseId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          distinct: ["courseId"],
          take: MAX_EXPLORED_COURSES,
        }),
      ]);

    const courses = await prisma.course.findMany({
      where: { id: { in: exploredCourseRows.map((r) => r.courseId!) } },
      select: { id: true, title: true },
    });
    const titleById = new Map(courses.map((c) => [c.id, c.title]));
    const recentlyExplored = exploredCourseRows.map((r) => titleById.get(r.courseId!)).filter((t): t is string => !!t);

    return NextResponse.json({
      coursesStarted,
      coursesCompleted,
      lessonsCompleted,
      assessmentsCompleted,
      currentStreakDays: computeStreakDays(recentEvents.map((e) => e.createdAt)),
      recentlyExplored,
    });
  });
}
