import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { computeStreakDays } from "@/lib/analytics/streakCore";
import { getTraineeInterestProfile } from "@/lib/analytics/interestScoring";

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

    const [coursesStarted, coursesCompleted, lessonsCompleted, assessmentsCompleted, submittedAttempts, recentEvents, exploredCourseRows] =
      await Promise.all([
        prisma.courseEnrollment.count({ where: { traineeId, unlockedAt: { not: null } } }),
        prisma.courseEnrollment.count({ where: { traineeId, completedAt: { not: null } } }),
        prisma.lessonProgress.count({ where: { traineeId } }),
        prisma.attempt.count({ where: { traineeId, status: "SUBMITTED" } }),
        // Dashboard/Examination redesign — the assessment-performance
        // numbers for "Analytics & Reports" (avg/highest score,
        // passed/failed counts), computed from the same SUBMITTED
        // attempts already being counted above, not a new query shape.
        prisma.attempt.findMany({
          where: { traineeId, status: "SUBMITTED" },
          select: { percentage: true, passed: true },
        }),
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

    // Analytics System Phase 3 — a trainee's own inferred interests,
    // the personal-analytics counterpart to the admin-facing one on
    // the trainee-detail page. Same underlying function, same
    // "behavioural association, not a fact about you" framing.
    const interests = await getTraineeInterestProfile(traineeId);

    const scored = submittedAttempts.filter((a) => a.percentage != null);
    const assessmentStats = {
      totalAttempts: submittedAttempts.length,
      totalPassed: submittedAttempts.filter((a) => a.passed === true).length,
      totalFailed: submittedAttempts.filter((a) => a.passed === false).length,
      averageScorePercent:
        scored.length === 0 ? null : Math.round(scored.reduce((sum, a) => sum + (a.percentage ?? 0), 0) / scored.length),
      highestScorePercent: scored.length === 0 ? null : Math.round(Math.max(...scored.map((a) => a.percentage ?? 0))),
    };

    return NextResponse.json({
      coursesStarted,
      coursesCompleted,
      lessonsCompleted,
      assessmentsCompleted,
      currentStreakDays: computeStreakDays(recentEvents.map((e) => e.createdAt)),
      recentlyExplored,
      primaryInterest: interests.primary,
      secondaryInterests: interests.secondary,
      assessmentStats,
    });
  });
}
