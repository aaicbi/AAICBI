import { prisma } from "@/lib/prisma";
import { notifyByEmail, type NotificationType } from "@/lib/notifications/log";

/**
 * Stage 6 audit — the shared fan-out behind "staff should be notified
 * when something new needs review": SUPER_ADMIN and ADMIN specifically,
 * not INSTRUCTOR — the same platform-wide-decision scoping already
 * established for employer approval (M31) and job posting review
 * (M34); reviewing what reaches the whole platform isn't a
 * course-scoped concern any instructor should be pulled into.
 *
 * Each recipient's own notifyByEmail call is independent — one
 * genuinely failing (a bad email address, a transient provider issue)
 * never blocks the others from being notified. The whole function is
 * also wrapped, not just each individual send — a failure in the
 * staff lookup itself (a DB blip) must never propagate back to the
 * caller and break the real flow this was called from (a registration
 * or job posting submission that already succeeded), the same
 * guarantee notifyByEmail itself provides.
 */
export async function notifyAllAdminStaff(
  type: NotificationType,
  relatedId: string | undefined,
  content: { subject: string; html: string; text: string },
  // Part 11 — optional click-through destination for the in-app
  // notification, typically the staff review queue for whatever just
  // came in (a pending employer, a pending job posting). Optional so
  // existing callers that have no meaningful destination stay
  // unchanged; when passed, every notified staff member's in-app
  // notification becomes actionable.
  url?: string
): Promise<void> {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
      select: { id: true, email: true },
    });
    for (const s of staff) {
      await notifyByEmail({
        recipientType: "STAFF",
        recipientId: s.id,
        to: s.email,
        type,
        relatedId,
        url,
        subject: content.subject,
        html: content.html,
        text: content.text,
      }).catch((e) => console.error(`Admin staff notification failed for user ${s.id}:`, e));
    }
  } catch (e) {
    console.error("notifyAllAdminStaff failed:", e);
  }
}
