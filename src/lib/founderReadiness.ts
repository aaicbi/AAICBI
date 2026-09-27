import { prisma } from "@/lib/prisma";

export interface FounderReadiness {
  courseTitle: string;
  percentage: number | null;
  topPercent: number | null; // e.g. 8 → "Top 8%"
}

// Below this many comparable attempts on the same exam, a percentile is
// statistical noise, not a real signal — omit topPercent rather than
// show a misleadingly precise "Top 100%"/"Top 0%" off a sample of one.
const MIN_COMPARABLE_ATTEMPTS = 3;

/**
 * Pitch & Post, Phase 2 — built from real data only. No "distinction"
 * or percentile field exists anywhere in this schema (see the Phase 1
 * plan's own confirmation of that), so this is computed fresh from the
 * trainee's most recent Certificate and, when one is linked, its
 * courseExamAttempt's real percentage — including this trainee among
 * every other trainee's attempt at the same exam to get a genuine
 * percentile, not an invented one.
 */
export async function getFounderReadiness(traineeId: string): Promise<FounderReadiness | null> {
  const certificate = await prisma.certificate.findFirst({
    where: { traineeId, revokedAt: null },
    orderBy: { issuedAt: "desc" },
    select: {
      course: { select: { title: true } },
      courseExamAttempt: { select: { percentage: true, examId: true } },
    },
  });
  if (!certificate) return null;

  const attempt = certificate.courseExamAttempt;
  if (!attempt || attempt.percentage == null) {
    return { courseTitle: certificate.course.title, percentage: null, topPercent: null };
  }

  const [totalCount, higherCount] = await Promise.all([
    prisma.attempt.count({
      where: { examId: attempt.examId, status: "SUBMITTED", percentage: { not: null } },
    }),
    prisma.attempt.count({
      where: { examId: attempt.examId, status: "SUBMITTED", percentage: { gt: attempt.percentage } },
    }),
  ]);

  // max(1, ...) — "Top 0%" reads as a broken figure, not a genuine one;
  // scoring higher than everyone else is still honestly "Top 1%," not
  // a literal zero.
  const topPercent = totalCount >= MIN_COMPARABLE_ATTEMPTS ? Math.max(1, Math.ceil((higherCount / totalCount) * 100)) : null;

  return { courseTitle: certificate.course.title, percentage: attempt.percentage, topPercent };
}
