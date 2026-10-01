/**
 * Analytics System — Phase 1. The single write path for
 * `AnalyticsEvent` — see that model's own schema comment for the full
 * scope decision (authenticated, in-app behaviour only; no anonymous
 * visitor tracking yet). Mirrors `notifyByEmail`'s own
 * never-throws-into-the-caller discipline: a failure here must never
 * break the real flow (a login, a course view, an exam submission)
 * this gets called from.
 */
import { prisma } from "@/lib/prisma";

// Deliberately does NOT include a "LOOP_ASKED" event — AiCommandLog
// already records every Loop Q&A with a timestamp and either
// askedByTraineeId or askedById; a second, duplicate event row for the
// exact same fact would be redundant data with no added query it makes
// possible. The analytics dashboard reads AiCommandLog directly for
// Loop usage instead — see src/lib/analytics/aggregate.ts.
export type AnalyticsEventType =
  | "LOGIN"
  | "COURSE_VIEWED"
  | "LESSON_COMPLETED"
  | "ASSESSMENT_STARTED"
  | "ASSESSMENT_COMPLETED";

export interface TrackEventInput {
  recipientType: "TRAINEE" | "STAFF";
  userId: string;
  type: AnalyticsEventType;
  courseId?: string | null;
  relatedId?: string | null;
  properties?: Record<string, unknown>;
}

export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        recipientType: input.recipientType,
        userId: input.userId,
        type: input.type,
        courseId: input.courseId ?? undefined,
        relatedId: input.relatedId ?? undefined,
        properties: input.properties as object | undefined,
      },
    });
  } catch (e) {
    console.error(`Failed to record analytics event ${input.type} for ${input.recipientType} ${input.userId}:`, e);
  }
  await maybePruneOldEvents();
}

// Same probabilistic prune-on-write retention as
// src/lib/notifications/log.ts's maybePruneOldLogs — this project has no
// background job infrastructure beyond the one existing cron, and firing
// on a small fraction of writes keeps the table bounded without adding a
// new scheduled job just for this.
const RETENTION_DAYS = 180;
const PRUNE_PROBABILITY = 0.005;

async function maybePruneOldEvents(): Promise<void> {
  if (Math.random() >= PRUNE_PROBABILITY) return;
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  } catch (e) {
    console.error("AnalyticsEvent pruning failed (non-fatal, will retry on a later write):", e);
  }
}
