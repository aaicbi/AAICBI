/**
 * M36 — postings past their closing date stop appearing on the job
 * board automatically (M35's own browse query already filters by
 * `closingDate`), but the *stored* `status` never actually transitions
 * on its own — left unaddressed, a posting would sit `APPROVED`
 * forever even though trainees can no longer see it, which is
 * dishonest for anyone looking at status directly: staff reviewing
 * postings, or the employer checking their own list.
 *
 * This project has no background job infrastructure (no cron, no
 * worker — see examEngine.ts's expireStaleAttemptsForTrainee and
 * notifications/log.ts's maybePruneOldLogs for the same real
 * constraint solved two different ways already). Unlike those two,
 * this isn't scoped to one trainee's dashboard load or a
 * low-probability write-time check — job postings have no single
 * "owner" whose page load would naturally sweep every stale posting
 * globally, and staff/employer views need the status to be honest
 * regardless of which specific posting they're looking at. A single,
 * global, unscoped bulk update, called from every route that reads
 * JobPosting rows in a context where a stale status would actually
 * mislead someone — not a targeted per-owner check the way the exam
 * attempt version is.
 *
 * A real, stated limit, not glossed over: if literally nothing reads
 * any JobPosting for a long stretch, an expired posting's status stays
 * stale until something does. Better than nothing, not a guarantee —
 * the same honest framing expireStaleAttemptsForTrainee's own comment
 * already uses for its own version of this trade-off.
 */
import { prisma } from "@/lib/prisma";

export async function expireStaleJobPostings(): Promise<void> {
  await prisma.jobPosting.updateMany({
    where: { status: "APPROVED", closingDate: { lte: new Date() } },
    data: { status: "EXPIRED" },
  });
}
