/**
 * Trainee Performance Dashboard — the Prisma-touching layer around
 * performanceDashboardCore.ts's pure functions. Built as reusable
 * service functions on purpose: both the admin dashboard page
 * (src/app/admin/courses/[id]/performance) and Loop's
 * get_module_assessment_stats tool (src/lib/loop/tools.ts) call
 * getModuleAssessmentStats directly, so there is exactly one place
 * that ever computes "has anyone attempted module X's assessment."
 *
 * Deliberately read-only and additive to what already exists:
 * at-risk status is READ from InactivityAlert/FailedAttemptsAlert
 * (M38), never recomputed with a new heuristic, and never triggers
 * checkInactivityForCourse itself — that lazy-refresh stays owned by
 * the early-warnings page, so opening this dashboard can't
 * accidentally fire alert emails as a side effect of a GET request.
 */
import { prisma } from "@/lib/prisma";
import { daysSince } from "@/lib/earlyWarningCore";
import { summarizeAttempts, computeCertificationStatus, computeOverallStatus, type AttemptSummary, type CertificationStatus, type OverallStatus } from "@/lib/performanceDashboardCore";

export interface TraineePerformanceRow extends AttemptSummary {
  traineeId: string;
  name: string;
  email: string;
  completedModules: number;
  totalModules: number;
  completionPct: number;
  certificationStatus: CertificationStatus;
  isAtRisk: boolean;
  atRiskReasons: string[];
  overallStatus: OverallStatus;
}

export interface PerformanceKpis {
  totalTrainees: number;
  averageCompletionPct: number;
  averageAssessmentScore: number | null;
  atRiskCount: number;
  certificationRate: number;
}

export interface ModuleAssessmentStat {
  moduleId: string;
  moduleTitle: string;
  hasAssessment: boolean;
  totalAttempts: number;
  distinctTraineesAttempted: number;
  averagePercentage: number | null;
  passRate: number | null;
}

export interface TraineePerformanceAttemptPoint {
  examTitle: string;
  moduleTitle: string | null;
  attemptNumber: number;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: Date | null;
  passMarkPercent: number | null;
  kind: "MODULE" | "COURSE_EXAM";
}

export interface TraineePerformanceDetail {
  traineeId: string;
  name: string;
  email: string;
  completedModules: number;
  totalModules: number;
  completionPct: number;
  certificationStatus: CertificationStatus;
  isAtRisk: boolean;
  atRiskReasons: string[];
  attempts: TraineePerformanceAttemptPoint[];
}

interface Filters {
  cohortId?: string;
  moduleId?: string;
}

/** Resolves the trainee ids this course's dashboard should include,
 * intersected with a cohort's roster when filtered. Cohort membership
 * is the separate Cohort/EnrollmentRecord model — CourseEnrollment has
 * no cohortId field. */
async function resolveTraineeIds(courseId: string, cohortId?: string): Promise<{ traineeId: string; name: string; email: string }[]> {
  const enrollments = await prisma.courseEnrollment.findMany({
    where: { courseId, unlockedAt: { not: null }, accessRevokedAt: null },
    select: { traineeId: true, trainee: { select: { id: true, name: true, email: true } } },
  });

  if (!cohortId) {
    return enrollments.map((e) => ({ traineeId: e.traineeId, name: e.trainee.name, email: e.trainee.email }));
  }

  const cohortMembers = await prisma.enrollmentRecord.findMany({
    where: { cohortId, traineeId: { in: enrollments.map((e) => e.traineeId) } },
    select: { traineeId: true },
  });
  const cohortTraineeIds = new Set(cohortMembers.map((m) => m.traineeId));
  return enrollments.filter((e) => cohortTraineeIds.has(e.traineeId)).map((e) => ({ traineeId: e.traineeId, name: e.trainee.name, email: e.trainee.email }));
}

/** Composes at-risk reason text in the exact same phrasing
 * earlyWarning.ts already uses internally for its notification bodies
 * — no new reason format invented here. */
async function getAtRiskReasons(courseId: string, traineeIds: string[]): Promise<Map<string, string[]>> {
  const reasons = new Map<string, string[]>();
  if (traineeIds.length === 0) return reasons;

  const [inactivityAlerts, failedAttemptsAlerts] = await Promise.all([
    prisma.inactivityAlert.findMany({
      where: { courseId, traineeId: { in: traineeIds } },
      include: { trainee: { select: { id: true, lastLoginAt: true } } },
    }),
    prisma.failedAttemptsAlert.findMany({
      where: { exam: { courseModule: { courseId } }, traineeId: { in: traineeIds } },
      include: { exam: { select: { title: true } } },
    }),
  ]);

  for (const alert of inactivityAlerts) {
    const days = daysSince(alert.trainee.lastLoginAt);
    const text = days != null ? `hasn't logged in for ${days} days` : "has never logged in";
    reasons.set(alert.traineeId, [...(reasons.get(alert.traineeId) ?? []), text]);
  }

  for (const alert of failedAttemptsAlerts) {
    const failedCount = await prisma.attempt.count({ where: { traineeId: alert.traineeId, examId: alert.examId, passed: false } });
    const text = `has now failed ${failedCount} attempts on "${alert.exam.title}"`;
    reasons.set(alert.traineeId, [...(reasons.get(alert.traineeId) ?? []), text]);
  }

  return reasons;
}

export async function getTraineePerformanceRows(courseId: string, filters: Filters = {}): Promise<TraineePerformanceRow[]> {
  const trainees = await resolveTraineeIds(courseId, filters.cohortId);
  const traineeIds = trainees.map((t) => t.traineeId);
  if (traineeIds.length === 0) return [];

  const moduleFilter = filters.moduleId ? { id: filters.moduleId } : {};

  const [totalModules, completionCounts, attempts, certificates, atRiskReasonsByTrainee] = await Promise.all([
    prisma.module.count({ where: { courseId, ...moduleFilter } }),
    prisma.moduleCompletion.groupBy({
      by: ["traineeId"],
      where: { traineeId: { in: traineeIds }, module: { courseId, ...moduleFilter } },
      _count: { _all: true },
    }),
    prisma.attempt.findMany({
      where: { traineeId: { in: traineeIds }, status: "SUBMITTED", exam: { courseModule: { courseId, ...moduleFilter } } },
      select: { traineeId: true, attemptNumber: true, percentage: true, passed: true, submittedAt: true },
    }),
    prisma.certificate.findMany({ where: { courseId, traineeId: { in: traineeIds } }, select: { traineeId: true, revokedAt: true } }),
    getAtRiskReasons(courseId, traineeIds),
  ]);

  const completedByTrainee = new Map(completionCounts.map((c) => [c.traineeId, c._count._all]));
  const certificateByTrainee = new Map(certificates.map((c) => [c.traineeId, c]));
  const attemptsByTrainee = new Map<string, typeof attempts>();
  for (const a of attempts) {
    attemptsByTrainee.set(a.traineeId, [...(attemptsByTrainee.get(a.traineeId) ?? []), a]);
  }

  return trainees.map((t) => {
    const completedModules = completedByTrainee.get(t.traineeId) ?? 0;
    const completionPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
    const summary = summarizeAttempts(attemptsByTrainee.get(t.traineeId) ?? []);
    const certificationStatus = computeCertificationStatus(certificateByTrainee.get(t.traineeId) ?? null);
    const atRiskReasons = atRiskReasonsByTrainee.get(t.traineeId) ?? [];
    const isAtRisk = atRiskReasons.length > 0;
    const overallStatus = computeOverallStatus({ completionPct, certificationStatus, isAtRisk });

    return {
      traineeId: t.traineeId,
      name: t.name,
      email: t.email,
      completedModules,
      totalModules,
      completionPct,
      ...summary,
      certificationStatus,
      isAtRisk,
      atRiskReasons,
      overallStatus,
    };
  });
}

export async function getPerformanceKpis(courseId: string, filters: Filters = {}): Promise<PerformanceKpis> {
  const rows = await getTraineePerformanceRows(courseId, filters);
  const totalTrainees = rows.length;
  const averageCompletionPct = totalTrainees === 0 ? 0 : Math.round(rows.reduce((sum, r) => sum + r.completionPct, 0) / totalTrainees);
  const rowsWithAttempts = rows.filter((r) => r.totalAttempts > 0);
  const averageAssessmentScore =
    rowsWithAttempts.length === 0 ? null : Math.round(rowsWithAttempts.reduce((sum, r) => sum + (r.averageScore ?? 0), 0) / rowsWithAttempts.length);
  const atRiskCount = rows.filter((r) => r.isAtRisk).length;
  const certificationRate = totalTrainees === 0 ? 0 : Math.round((rows.filter((r) => r.certificationStatus === "ISSUED").length / totalTrainees) * 100);

  return { totalTrainees, averageCompletionPct, averageAssessmentScore, atRiskCount, certificationRate };
}

export async function getModuleAssessmentStats(courseId: string, moduleId?: string): Promise<ModuleAssessmentStat[]> {
  const modules = await prisma.module.findMany({
    where: { courseId, ...(moduleId ? { id: moduleId } : {}) },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      assessment: {
        select: {
          attempts: { where: { status: "SUBMITTED" }, select: { traineeId: true, percentage: true, passed: true } },
        },
      },
    },
  });

  return modules.map((m) => {
    if (!m.assessment) {
      return { moduleId: m.id, moduleTitle: m.title, hasAssessment: false, totalAttempts: 0, distinctTraineesAttempted: 0, averagePercentage: null, passRate: null };
    }
    const attempts = m.assessment.attempts;
    const totalAttempts = attempts.length;
    const distinctTraineesAttempted = new Set(attempts.map((a) => a.traineeId)).size;
    const averagePercentage = totalAttempts === 0 ? null : Math.round(attempts.reduce((sum, a) => sum + (a.percentage ?? 0), 0) / totalAttempts);
    const passRate = totalAttempts === 0 ? null : Math.round((attempts.filter((a) => a.passed).length / totalAttempts) * 100);
    return { moduleId: m.id, moduleTitle: m.title, hasAssessment: true, totalAttempts, distinctTraineesAttempted, averagePercentage, passRate };
  });
}

export async function getTraineePerformanceDetail(courseId: string, traineeId: string): Promise<TraineePerformanceDetail | null> {
  const enrollment = await prisma.courseEnrollment.findFirst({
    where: { courseId, traineeId },
    select: { trainee: { select: { id: true, name: true, email: true } } },
  });
  if (!enrollment) return null;

  const [totalModules, completedModules, attempts, certificate, atRiskReasonsByTrainee] = await Promise.all([
    prisma.module.count({ where: { courseId } }),
    prisma.moduleCompletion.count({ where: { traineeId, module: { courseId } } }),
    prisma.attempt.findMany({
      where: {
        traineeId,
        status: "SUBMITTED",
        exam: { OR: [{ courseModule: { courseId } }, { courseId }] },
      },
      select: {
        attemptNumber: true,
        percentage: true,
        passed: true,
        submittedAt: true,
        passMarkPercent: true,
        exam: { select: { title: true, moduleId: true, courseId: true, courseModule: { select: { title: true } } } },
      },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.certificate.findFirst({ where: { courseId, traineeId }, select: { revokedAt: true } }),
    getAtRiskReasons(courseId, [traineeId]),
  ]);

  const completionPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
  const certificationStatus = computeCertificationStatus(certificate ?? null);
  const atRiskReasons = atRiskReasonsByTrainee.get(traineeId) ?? [];

  const attemptPoints: TraineePerformanceAttemptPoint[] = attempts.map((a) => ({
    examTitle: a.exam.title,
    moduleTitle: a.exam.courseModule?.title ?? null,
    attemptNumber: a.attemptNumber,
    percentage: a.percentage,
    passed: a.passed,
    submittedAt: a.submittedAt,
    passMarkPercent: a.passMarkPercent,
    kind: a.exam.moduleId ? "MODULE" : "COURSE_EXAM",
  }));

  return {
    traineeId,
    name: enrollment.trainee.name,
    email: enrollment.trainee.email,
    completedModules,
    totalModules,
    completionPct,
    certificationStatus,
    isAtRisk: atRiskReasons.length > 0,
    atRiskReasons,
    attempts: attemptPoints,
  };
}
