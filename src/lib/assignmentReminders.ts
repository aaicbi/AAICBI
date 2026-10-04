/**
 * AI Assignment Engine, Phase 2 — the due-date reminder sweep,
 * structured exactly like enrollmentReminders.ts's own
 * sendDueAccessExpiryReminders: called only from the existing Vercel
 * Cron route (no new cron entry needed — see that route's own
 * updated comment), same create-then-catch-P2002 idempotency via
 * AssignmentReminderSent so a second run on the same day never sends a
 * duplicate.
 *
 * A fixed 2-days-before-due + 1-day-after-due pair, deliberately not a
 * configurable list like courses' own reminderDaysBeforeExpiry — see
 * the plan's own "explicitly out of scope" for why.
 */
import { prisma } from "@/lib/prisma";
import { shouldNotifyTrainee, notifyByEmail } from "@/lib/notifications/log";
import { assignmentDueSoonEmail, assignmentOverdueEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const DUE_SOON_DAYS_BEFORE = 2;

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Trainees actively enrolled in the assignment's own course who have
 * NOT yet submitted (no submission row, or one still IN_PROGRESS) —
 * exactly who a due-date reminder is for; someone who already
 * submitted has nothing left to be reminded about. */
async function findTraineesYetToSubmit(assignmentId: string, courseId: string): Promise<{ id: string; name: string; email: string; notificationsEnabled: boolean }[]> {
  const enrolled = await prisma.courseEnrollment.findMany({
    where: { courseId, unlockedAt: { not: null }, accessRevokedAt: null },
    select: { trainee: { select: { id: true, name: true, email: true, notificationsEnabled: true } } },
  });
  const submitted = await prisma.assignmentSubmission.findMany({
    where: { assignmentId, status: { not: "IN_PROGRESS" } },
    select: { traineeId: true },
  });
  const submittedIds = new Set(submitted.map((s) => s.traineeId));
  return enrolled.map((e) => e.trainee).filter((t) => !submittedIds.has(t.id));
}

export async function sendDueAssignmentReminders(): Promise<number> {
  const assignments = await prisma.assignment.findMany({
    where: { status: "PUBLISHED", dueAt: { not: null } },
    select: { id: true, title: true, dueAt: true, courseId: true, module: { select: { courseId: true } } },
  });

  let sentCount = 0;
  const now = new Date();
  const today = startOfDayUTC(now);

  for (const assignment of assignments) {
    const courseId = assignment.courseId ?? assignment.module?.courseId ?? null;
    if (!courseId) continue;
    const dueAt = assignment.dueAt!;

    const daysUntilDue = Math.round((startOfDayUTC(dueAt).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const reminderType: "DUE_SOON" | "OVERDUE" | null =
      daysUntilDue === DUE_SOON_DAYS_BEFORE ? "DUE_SOON" : daysUntilDue === -1 ? "OVERDUE" : null;
    if (!reminderType) continue;

    const trainees = await findTraineesYetToSubmit(assignment.id, courseId);
    for (const trainee of trainees) {
      try {
        await prisma.assignmentReminderSent.create({
          data: { assignmentId: assignment.id, traineeId: trainee.id, type: reminderType },
        });
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code === "P2002") continue; // already sent this exact reminder for this assignment/trainee
        throw e;
      }

      if (!shouldNotifyTrainee(trainee)) continue;

      const relativeUrl = `/trainee/assignments/${assignment.id}`;
      const assignmentUrl = appUrl(relativeUrl);
      const dueDateLabel = dueAt.toLocaleDateString();
      const content =
        reminderType === "DUE_SOON"
          ? assignmentDueSoonEmail({ traineeName: trainee.name, assignmentTitle: assignment.title, dueDateLabel, assignmentUrl })
          : assignmentOverdueEmail({ traineeName: trainee.name, assignmentTitle: assignment.title, dueDateLabel, assignmentUrl });

      await notifyByEmail({
        recipientType: "TRAINEE",
        recipientId: trainee.id,
        to: trainee.email,
        type: reminderType === "DUE_SOON" ? "ASSIGNMENT_DUE_SOON" : "ASSIGNMENT_OVERDUE",
        relatedId: assignment.id,
        url: relativeUrl,
        subject: content.subject,
        html: content.html,
        text: content.text,
      }).catch((e) => console.error(`Failed to send assignment ${reminderType} reminder for trainee ${trainee.id}, assignment ${assignment.id}:`, e));
      sentCount++;
    }
  }

  return sentCount;
}
