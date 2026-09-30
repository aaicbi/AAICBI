/**
 * Course enrollment/subscription system — the admin-configurable
 * expiry/renewal-reminder sweep (task Section 13), called only from the
 * Vercel Cron route (src/app/api/cron/course-access-sweep/route.ts).
 * Originally scoped to FIXED_DURATION courses only, on the assumption
 * that a RECURRING_SUBSCRIPTION course's Paystack-driven
 * subscription.not_renew/invoice.payment_failed emails already covered
 * the same need — flagged as inaccurate on review: those only fire on
 * CANCELLATION or a FAILED charge, never as a plain heads-up before an
 * upcoming successful auto-renewal. Both access models now go through
 * the same sweep, `currentPeriodEnd` meaning "when access lapses"
 * for one and "when the next charge happens" for the other — each
 * gets its own template/copy (accessExpiringReminderEmail's "act now or
 * lose access" framing is wrong for a subscription that renews itself).
 *
 * Genuinely can't be a lazy "check on next touchpoint" function like
 * expireLapsedEnrollmentsForTrainee — a reminder has to go out BEFORE
 * a trainee visits, by definition, which is exactly why this milestone
 * introduces this project's first real cron job at all.
 */
import { prisma } from "@/lib/prisma";
import { shouldNotifyTrainee, notifyByEmail } from "@/lib/notifications/log";
import { accessExpiringReminderEmail, subscriptionRenewingReminderEmail } from "@/lib/notifications/templates";
import { getEffectivePriceKobo } from "@/lib/coursePricing";

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function sendDueAccessExpiryReminders(): Promise<number> {
  const courses = await prisma.course.findMany({
    where: { reminderEnabled: true },
    select: {
      id: true,
      title: true,
      accessModel: true,
      reminderDaysBeforeExpiry: true,
      priceKobo: true,
      discountPercent: true,
    },
  });

  let sentCount = 0;
  const appUrl = process.env.APP_URL ?? "https://aaicbi.org";

  for (const course of courses) {
    const effectivePriceKobo = getEffectivePriceKobo(course);

    for (const daysBeforeExpiry of course.reminderDaysBeforeExpiry) {
      const windowStart = startOfDayUTC(new Date());
      windowStart.setUTCDate(windowStart.getUTCDate() + daysBeforeExpiry);
      const windowEnd = new Date(windowStart);
      windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);

      const dueEnrollments = await prisma.courseEnrollment.findMany({
        where: {
          courseId: course.id,
          accessRevokedAt: null,
          unlockedAt: { not: null },
          currentPeriodEnd: { gte: windowStart, lt: windowEnd },
        },
        select: { id: true, traineeId: true, currentPeriodEnd: true },
      });

      for (const enrollment of dueEnrollments) {
        // Same individual-create-plus-caught-P2002 idempotency
        // discipline as PaystackEvent — a second cron run on the same
        // day (a retry, an overlapping manual trigger) must never send
        // a duplicate reminder for the same enrollment/period/
        // threshold. `periodEnd` is part of the key specifically so a
        // renewal that moves currentPeriodEnd forward can re-fire the
        // same day-threshold for the NEW period later.
        try {
          await prisma.enrollmentReminderSent.create({
            data: { enrollmentId: enrollment.id, daysBeforeExpiry, periodEnd: enrollment.currentPeriodEnd! },
          });
        } catch (e) {
          const code = (e as { code?: string })?.code;
          if (code === "P2002") continue; // already sent for this exact enrollment/period/threshold
          throw e;
        }

        const trainee = await prisma.trainee.findUnique({ where: { id: enrollment.traineeId } });
        if (!trainee || !shouldNotifyTrainee(trainee)) continue;

        const relativeUrl = `/trainee/courses/${course.id}`;
        const courseUrl = `${appUrl}${relativeUrl}`;
        const content =
          course.accessModel === "RECURRING_SUBSCRIPTION"
            ? subscriptionRenewingReminderEmail({
                traineeName: trainee.name,
                courseTitle: course.title,
                daysRemaining: daysBeforeExpiry,
                renewalDate: enrollment.currentPeriodEnd!.toLocaleDateString(),
                amountKobo: effectivePriceKobo ?? 0,
                courseUrl,
              })
            : accessExpiringReminderEmail({
                traineeName: trainee.name,
                courseTitle: course.title,
                daysRemaining: daysBeforeExpiry,
                expiryDate: enrollment.currentPeriodEnd!.toLocaleDateString(),
                courseUrl,
              });
        await notifyByEmail({
          recipientType: "TRAINEE",
          recipientId: enrollment.traineeId,
          to: trainee.email,
          type: course.accessModel === "RECURRING_SUBSCRIPTION" ? "SUBSCRIPTION_RENEWING_REMINDER" : "ACCESS_EXPIRING_REMINDER",
          relatedId: enrollment.id,
          url: relativeUrl,
          subject: content.subject,
          html: content.html,
          text: content.text,
        }).catch((e) => console.error(`Failed to send expiry/renewal reminder for enrollment ${enrollment.id}:`, e));
        sentCount++;
      }
    }
  }

  return sentCount;
}
