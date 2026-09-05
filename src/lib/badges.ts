/**
 * M20 — badge issuance. Purely motivational, never a credential (see
 * the schema comment on Badge) — unlike Certificate, no email is sent
 * for a badge, and nothing about the platform's actual functionality
 * depends on one existing. Follows the exact same structural pattern
 * as certificates.ts (same call site, same race-safety discipline)
 * since it answers a genuinely similar question — "did crossing this
 * completion state just happen" — just for three thresholds instead
 * of one binary condition.
 */
import { prisma } from "@/lib/prisma";

const THRESHOLDS = [25, 50, 75] as const;

/**
 * Called from progress.ts's getModuleLockMap — the cheapest place to
 * answer "what percent of this course's modules are complete now,"
 * since the caller already has every module's final state in hand, no
 * extra query needed. Certificate issuance used to be called from this
 * exact spot too, until M23 moved it to a different trigger entirely
 * (passing the course examination, not module completion) — badges
 * are unaffected by that change and still fire from here, a real,
 * deliberate difference between the two: a badge is progress-tracking,
 * never a credential the way a certificate is (see the schema comment
 * on Badge).
 *
 * A single module completing can cross more than one threshold at
 * once (a two-module course goes straight from 0% to 50%, crossing
 * both 25 and 50 in the same call) — each threshold is checked and
 * awarded independently rather than assuming only the "current"
 * threshold could possibly be new.
 *
 * Race-safe the same way ModuleCompletion and Certificate both are:
 * an individual `create()` per threshold with a caught P2002, not a
 * bulk operation — `@@unique([traineeId, courseId, threshold])` is
 * what makes this safe, see the schema comment on Badge.
 *
 * Never throws — a failure here must never affect the module-locking
 * computation this function piggybacks on, the same reasoning as
 * every other hook in this project.
 */
export async function checkAndIssueBadges(
  courseId: string,
  traineeId: string,
  moduleCompletions: { completed: boolean }[]
): Promise<void> {
  if (moduleCompletions.length === 0) return; // a course with no modules has no percentage to speak of

  const percentComplete = Math.round(
    (moduleCompletions.filter((m) => m.completed).length / moduleCompletions.length) * 100
  );

  for (const threshold of THRESHOLDS) {
    if (percentComplete < threshold) continue;
    try {
      await prisma.badge.create({ data: { traineeId, courseId, threshold } });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") continue; // already awarded, or lost a concurrent race — either way, not an error
      // Outer catch below still applies as a final backstop, but log
      // precisely which threshold failed here — swallowing this loop
      // iteration's real errors into a generic outer-catch message
      // would lose exactly the detail worth knowing to debug it.
      console.error(`Badge issuance failed for trainee ${traineeId}, course ${courseId}, threshold ${threshold}:`, e);
    }
  }
}
