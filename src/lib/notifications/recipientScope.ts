import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

/**
 * Resolves a session to the (recipientType, recipientId) bucket its own
 * notifications are actually addressed under in UserNotification —
 * shared by every /api/notifications route so this mapping can't drift
 * between "list", "mark one read", and "mark all read" the way it
 * already had before this file existed (three independent copies of
 * the same ternary).
 *
 * Two real bugs fixed by centralizing this, both confirmed live:
 * 1. A training org's own ADMIN session (TrainingOrganization.
 *    staffUserId) was falling into the generic "STAFF" bucket — the
 *    same one genuine AAICBI staff use — which meant it saw every
 *    staff-only notification (other organizations' approval queue,
 *    platform-wide payment receipts) and never saw its own
 *    (recipientType "TRAINING_ORG", keyed by the organization's own
 *    id, not the shadow User's id — see notifyByEmail's recipientType
 *    union, src/lib/notifications/log.ts).
 * 2. An INVESTOR session fell into the same "STAFF" bucket too (the
 *    original ternary had no INVESTOR branch at all) — a separate,
 *    pre-existing instance of the identical class of bug, fixed here
 *    since it's the same logic being rewritten anyway.
 */
export async function resolveNotificationRecipient(session: { userId: string; role: string }): Promise<{ recipientType: string; recipientId: string }> {
  if (session.role === "TRAINEE") return { recipientType: "TRAINEE", recipientId: session.userId };
  if (session.role === "EMPLOYER") return { recipientType: "EMPLOYER", recipientId: session.userId };
  if (session.role === "INVESTOR") return { recipientType: "INVESTOR", recipientId: session.userId };
  const trainingOrg = session.role === "ADMIN" ? await findTrainingOrgByStaffUserId(session.userId) : null;
  return trainingOrg ? { recipientType: "TRAINING_ORG", recipientId: trainingOrg.id } : { recipientType: "STAFF", recipientId: session.userId };
}
