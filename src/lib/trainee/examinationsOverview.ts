/**
 * Dashboard/Examination redesign — a read-only aggregation over the
 * existing exam engine's own data, for a trainee's new Examinations
 * table (and the dashboard's compact "Your Examinations" summary).
 * Every rule here is a direct reuse of an already-exported function or
 * an already-established query shape — see the inline references below
 * — never a parallel reimplementation of locking, cooldown, or
 * completion logic.
 *
 * Deliberately excludes standalone by-code exams: they have no
 * existing trainee browsing page to link `actionHref` at (only a
 * direct-link/code-entry flow), so including them here would mean
 * inventing a new entry flow rather than surfacing an existing one.
 */
import { prisma } from "@/lib/prisma";
import { getModuleLockMap } from "@/lib/progress";
import { nextAttemptAllowedAt } from "@/lib/cooldownCore";
import { expireStaleAttemptsForTrainee } from "@/lib/examEngine";

export type ExamOverviewStatus =
  | "LOCKED"
  | "AVAILABLE"
  | "IN_PROGRESS"
  | "COOLDOWN"
  | "PASSED"
  | "RETAKE_AVAILABLE"
  | "ATTEMPTS_EXHAUSTED";

export interface TraineeExamRow {
  examId: string;
  title: string;
  kind: "MODULE_ASSESSMENT" | "COURSE_EXAMINATION";
  courseId: string;
  courseTitle: string;
  moduleId: string | null;
  moduleTitle: string | null;
  totalQuestions: number;
  durationMinutes: number;
  passMarkPercent: number;
  maxAttempts: number | null;
  attemptsUsed: number;
  bestPercentage: number | null;
  passed: boolean;
  status: ExamOverviewStatus;
  cooldownEndsAt: Date | null;
  actionHref: string;
}

interface AttemptSlice {
  status: string;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: Date | null;
}

function deriveStatus(
  locked: boolean,
  attempts: AttemptSlice[],
  maxAttempts: number | null,
  cooldownEndsAt: Date | null
): ExamOverviewStatus {
  if (locked) return "LOCKED";
  const hasInProgress = attempts.some((a) => a.status === "IN_PROGRESS");
  if (hasInProgress) return "IN_PROGRESS";
  const passed = attempts.some((a) => a.status === "SUBMITTED" && a.passed === true);
  if (passed) return "PASSED";
  if (cooldownEndsAt) return "COOLDOWN";
  const attemptsUsed = attempts.length;
  if (maxAttempts != null && attemptsUsed >= maxAttempts) return "ATTEMPTS_EXHAUSTED";
  return attemptsUsed > 0 ? "RETAKE_AVAILABLE" : "AVAILABLE";
}

function bestPercentage(attempts: AttemptSlice[]): number | null {
  const scored = attempts.filter((a) => a.status === "SUBMITTED" && a.percentage != null);
  if (scored.length === 0) return null;
  return Math.max(...scored.map((a) => a.percentage as number));
}

export async function getTraineeExaminationOverview(traineeId: string): Promise<TraineeExamRow[]> {
  // Same best-effort sweep the dashboard already runs on every load —
  // reused here so "Continue" never points at an attempt that's
  // actually timed out but hasn't been swept yet.
  await expireStaleAttemptsForTrainee(traineeId);

  const enrollments = await prisma.courseEnrollment.findMany({
    where: { traineeId, unlockedAt: { not: null }, accessRevokedAt: null },
    select: { courseId: true },
  });
  if (enrollments.length === 0) return [];
  const courseIds = enrollments.map((e) => e.courseId);

  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: {
      id: true,
      title: true,
      modules: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          assessment: {
            select: {
              id: true,
              title: true,
              published: true,
              durationMinutes: true,
              passMarkPercent: true,
              maxAttempts: true,
              numQuestions: true,
              _count: { select: { questions: true } },
            },
          },
        },
      },
      courseExamination: {
        select: {
          id: true,
          title: true,
          published: true,
          durationMinutes: true,
          passMarkPercent: true,
          maxAttempts: true,
          numQuestions: true,
          retakeCooldownHours: true,
          _count: { select: { questions: true } },
        },
      },
    },
  });

  const rows: TraineeExamRow[] = [];

  for (const course of courses) {
    // Single source of truth for lock/completion — same function the
    // course page and every attempt-start route already trust.
    const lockMap = await getModuleLockMap(course.id, traineeId);

    for (const mod of course.modules) {
      const exam = mod.assessment;
      if (!exam || !exam.published) continue;

      const attempts = await prisma.attempt.findMany({
        where: { examId: exam.id, traineeId },
        select: { status: true, percentage: true, passed: true, submittedAt: true },
      });

      const locked = !lockMap[mod.id]?.unlocked;
      const status = deriveStatus(locked, attempts, exam.maxAttempts, null);

      rows.push({
        examId: exam.id,
        title: exam.title,
        kind: "MODULE_ASSESSMENT",
        courseId: course.id,
        courseTitle: course.title,
        moduleId: mod.id,
        moduleTitle: mod.title,
        totalQuestions: exam.numQuestions ?? exam._count.questions,
        durationMinutes: exam.durationMinutes,
        passMarkPercent: exam.passMarkPercent,
        maxAttempts: exam.maxAttempts,
        attemptsUsed: attempts.length,
        bestPercentage: bestPercentage(attempts),
        passed: attempts.some((a) => a.status === "SUBMITTED" && a.passed === true),
        status,
        cooldownEndsAt: null,
        actionHref: `/trainee/courses/${course.id}/modules/${mod.id}/assessment`,
      });
    }

    const courseExam = course.courseExamination;
    if (courseExam && courseExam.published) {
      const attempts = await prisma.attempt.findMany({
        where: { examId: courseExam.id, traineeId },
        select: { status: true, percentage: true, passed: true, submittedAt: true },
      });

      // Exact same enforcement query as POST
      // /api/courses/[id]/examination/attempts — see that route's own
      // comment on why the cooldown override must be checked here too.
      const [lastSubmitted, override] = await Promise.all([
        prisma.attempt.findFirst({
          where: { examId: courseExam.id, traineeId, status: "SUBMITTED" },
          orderBy: { submittedAt: "desc" },
          select: { submittedAt: true },
        }),
        prisma.cooldownOverride.findUnique({
          where: { traineeId_examId: { traineeId, examId: courseExam.id } },
          select: { grantedAt: true },
        }),
      ]);
      const cooldownEndsAt = nextAttemptAllowedAt(
        courseExam.retakeCooldownHours,
        lastSubmitted?.submittedAt ?? null,
        override?.grantedAt ?? null
      );

      const allModulesComplete =
        course.modules.length > 0 && course.modules.every((m) => lockMap[m.id]?.completed === true);
      const locked = !allModulesComplete;
      const status = deriveStatus(locked, attempts, courseExam.maxAttempts, cooldownEndsAt);

      rows.push({
        examId: courseExam.id,
        title: courseExam.title,
        kind: "COURSE_EXAMINATION",
        courseId: course.id,
        courseTitle: course.title,
        moduleId: null,
        moduleTitle: null,
        totalQuestions: courseExam.numQuestions ?? courseExam._count.questions,
        durationMinutes: courseExam.durationMinutes,
        passMarkPercent: courseExam.passMarkPercent,
        maxAttempts: courseExam.maxAttempts,
        attemptsUsed: attempts.length,
        bestPercentage: bestPercentage(attempts),
        passed: attempts.some((a) => a.status === "SUBMITTED" && a.passed === true),
        status,
        cooldownEndsAt,
        actionHref: `/trainee/courses/${course.id}/examination`,
      });
    }
  }

  return rows;
}
