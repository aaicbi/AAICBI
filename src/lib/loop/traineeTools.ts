/**
 * Loop for Trainees — the Learning Buddy persona's own "eyes" on the
 * platform, the trainee-scoped twin of src/lib/loop/tools.ts (the
 * staff Executive Assistant's tool set). Same read-only discipline:
 * every function here is a plain Prisma `findUnique`/`findMany`/
 * `count` — no `create`/`update`/`upsert`/`delete` anywhere in this
 * file.
 *
 * The one rule that makes this file different from tools.ts, not just
 * a smaller copy of it: every function takes `traineeId` as a plain
 * function argument the calling route supplies from `session.userId`
 * — it is NEVER a field in any tool's `input_schema` the model could
 * set. There is structurally no way for the Learning Buddy to ask for
 * or receive another trainee's data, because no tool exposes a
 * trainee-identifying parameter for the model to fill in at all.
 *
 * The second rule, just as deliberate: nothing in this file ever
 * selects from `Question`/`Option`/`Answer`, and nothing here can ever
 * reveal `isCorrect`/`explanation` for any attempt, in progress or
 * submitted. Every performance signal comes from `PerformanceSummary`
 * — M13's own AI-generated narrative, itself already grounded only in
 * aggregated topic stats, never raw question text (see
 * src/lib/ai/analyzePerformance.ts's header comment) — or from plain
 * scores/percentages already safe to show the trainee who earned them.
 * This is what lets the Learning Buddy skip the "must be unavailable
 * during a live attempt" problem entirely for now: there is nothing
 * here for it to leak regardless of attempt state.
 */
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------
// get_my_progress

export async function getMyProgress(traineeId: string) {
  const enrollments = await prisma.courseEnrollment.findMany({
    where: { traineeId },
    include: { course: { select: { id: true, title: true } } },
    orderBy: { enrolledAt: "desc" },
  });

  const enrollmentDetails = await Promise.all(
    enrollments.map(async (e) => {
      const [totalModules, completedModules] = await Promise.all([
        prisma.module.count({ where: { courseId: e.course.id } }),
        prisma.moduleCompletion.count({ where: { traineeId, module: { courseId: e.course.id } } }),
      ]);
      return {
        courseTitle: e.course.title,
        status: e.completedAt
          ? "completed"
          : e.accessRevokedAt
            ? "expired_or_revoked"
            : e.unlockedAt
              ? "active"
              : "awaiting_unlock",
        enrolledAt: e.enrolledAt,
        totalModules,
        completedModules,
      };
    })
  );

  return { enrollments: enrollmentDetails };
}

// ---------------------------------------------------------------------
// get_my_performance_summaries

export async function getMyPerformanceSummaries(traineeId: string) {
  const summaries = await prisma.performanceSummary.findMany({
    where: { attempt: { traineeId, status: "SUBMITTED" } },
    include: { attempt: { select: { percentage: true, passed: true, submittedAt: true, exam: { select: { title: true } } } } },
    orderBy: { generatedAt: "desc" },
    take: 10,
  });

  return {
    summaries: summaries.map((s) => ({
      examTitle: s.attempt.exam.title,
      percentage: s.attempt.percentage,
      passed: s.attempt.passed,
      submittedAt: s.attempt.submittedAt,
      strengths: s.strengths,
      weaknesses: s.weaknesses,
      narrative: s.narrative,
    })),
  };
}

// ---------------------------------------------------------------------
// get_my_achievements

export async function getMyAchievements(traineeId: string) {
  const [certificates, badges] = await Promise.all([
    prisma.certificate.findMany({
      where: { traineeId, revokedAt: null },
      include: { course: { select: { title: true } } },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.badge.findMany({
      where: { traineeId },
      include: { course: { select: { title: true } } },
      orderBy: { awardedAt: "desc" },
    }),
  ]);

  return {
    certificates: certificates.map((c) => ({ courseTitle: c.course.title, code: c.code, issuedAt: c.issuedAt })),
    badges: badges.map((b) => ({ courseTitle: b.course.title, threshold: b.threshold, awardedAt: b.awardedAt })),
  };
}

// ---------------------------------------------------------------------
// get_my_recent_activity

const RECENT_ACTIVITY_LIMIT = 10;

export async function getMyRecentActivity(traineeId: string) {
  const [lessons, modules] = await Promise.all([
    prisma.lessonProgress.findMany({
      where: { traineeId },
      include: { lesson: { select: { title: true, module: { select: { title: true, course: { select: { title: true } } } } } } },
      orderBy: { completedAt: "desc" },
      take: RECENT_ACTIVITY_LIMIT,
    }),
    prisma.moduleCompletion.findMany({
      where: { traineeId },
      include: { module: { select: { title: true, course: { select: { title: true } } } } },
      orderBy: { completedAt: "desc" },
      take: RECENT_ACTIVITY_LIMIT,
    }),
  ]);

  return {
    recentLessonsCompleted: lessons.map((l) => ({
      lessonTitle: l.lesson.title,
      moduleTitle: l.lesson.module.title,
      courseTitle: l.lesson.module.course.title,
      completedAt: l.completedAt,
    })),
    recentModulesCompleted: modules.map((m) => ({
      moduleTitle: m.module.title,
      courseTitle: m.module.course.title,
      completedAt: m.completedAt,
    })),
  };
}

// ---------------------------------------------------------------------
// Tool schemas (Anthropic tool-use format) — no tool below ever
// declares a trainee/course-"whose"-identifying input field. The route
// that calls these supplies `traineeId` itself, from `session.userId`.

export const TRAINEE_TOOL_SCHEMAS = [
  {
    name: "get_my_progress",
    description: "Get the trainee's own course enrollments, with module completion counts per course.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_my_performance_summaries",
    description:
      "Get the trainee's own AI-generated performance summaries from past submitted assessments — percentage, pass/fail, and a strengths/weaknesses narrative per attempt. This is the ONLY source of performance detail available — never guess at or invent a score, topic, or result not returned here.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_my_achievements",
    description: "Get the trainee's own earned certificates and milestone badges.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_my_recent_activity",
    description: "Get the trainee's own most recently completed lessons and modules, for a 'what have you done lately' view.",
    input_schema: { type: "object" as const, properties: {} },
  },
];

export async function runTraineeLoopTool(name: string, traineeId: string): Promise<unknown> {
  switch (name) {
    case "get_my_progress":
      return getMyProgress(traineeId);
    case "get_my_performance_summaries":
      return getMyPerformanceSummaries(traineeId);
    case "get_my_achievements":
      return getMyAchievements(traineeId);
    case "get_my_recent_activity":
      return getMyRecentActivity(traineeId);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
