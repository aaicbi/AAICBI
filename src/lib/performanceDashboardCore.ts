/**
 * Trainee Performance Dashboard — pure decision functions, no Prisma.
 * Same split as earlyWarningCore.ts vs earlyWarning.ts: the Prisma-
 * touching orchestration lives in performanceDashboard.ts, this file
 * only ever transforms data it's handed.
 */

export interface RawAttempt {
  attemptNumber: number;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: Date | null;
}

export type Trend = "improving" | "declining" | "flat" | "insufficient-data";

export interface AttemptSummary {
  firstScore: number | null;
  bestScore: number | null;
  latestScore: number | null;
  averageScore: number | null;
  totalAttempts: number;
  passedOnAttempt: number | null;
  trend: Trend;
}

/** Orders attempts by submission time (attempts without a submittedAt,
 * i.e. never actually submitted, are excluded — this summary only ever
 * describes real, graded attempts). */
export function summarizeAttempts(attempts: RawAttempt[]): AttemptSummary {
  const submitted = attempts
    .filter((a): a is RawAttempt & { submittedAt: Date; percentage: number } => a.submittedAt != null && a.percentage != null)
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

  if (submitted.length === 0) {
    return { firstScore: null, bestScore: null, latestScore: null, averageScore: null, totalAttempts: 0, passedOnAttempt: null, trend: "insufficient-data" };
  }

  const scores = submitted.map((a) => a.percentage);
  const firstScore = scores[0];
  const latestScore = scores[scores.length - 1];
  const bestScore = Math.max(...scores);
  const averageScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const passedAttempt = submitted.find((a) => a.passed);

  let trend: Trend = "insufficient-data";
  if (submitted.length >= 2) {
    const previousScore = scores[scores.length - 2];
    trend = latestScore > previousScore ? "improving" : latestScore < previousScore ? "declining" : "flat";
  }

  return {
    firstScore,
    bestScore,
    latestScore,
    averageScore,
    totalAttempts: submitted.length,
    passedOnAttempt: passedAttempt?.attemptNumber ?? null,
    trend,
  };
}

export type CertificationStatus = "ISSUED" | "REVOKED" | "NOT_YET";

export function computeCertificationStatus(certificate: { revokedAt: Date | null } | null): CertificationStatus {
  if (!certificate) return "NOT_YET";
  return certificate.revokedAt ? "REVOKED" : "ISSUED";
}

export type OverallStatus = "ON_TRACK" | "AT_RISK" | "COMPLETED";

export function computeOverallStatus(input: { completionPct: number; certificationStatus: CertificationStatus; isAtRisk: boolean }): OverallStatus {
  if (input.isAtRisk) return "AT_RISK";
  if (input.certificationStatus === "ISSUED" || input.completionPct >= 100) return "COMPLETED";
  return "ON_TRACK";
}
