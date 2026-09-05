/**
 * M27 — finding the right CourseEnrollment from a subscription-related
 * webhook event. Two correlation strategies, deliberately layered, not
 * just one: `paystackSubscriptionCode` is the direct, correct way IF
 * `subscription.create` (M26) successfully recorded it earlier — but
 * that event's exact field shape was never fully confirmed against
 * Paystack's own documentation (see that handler's own comment), so a
 * fallback exists specifically in case that earlier step silently
 * didn't work. Given this project's own roadmap calls getting
 * revocation right "the single most important failure mode" in this
 * whole milestone, relying on exactly one correlation path — one that
 * depends on an earlier, honestly-uncertain step having worked — isn't
 * a risk worth taking here.
 *
 * `strictCodeMatch` exists because of a real, serious bug found on
 * audit and verified live against real Postgres, not just reasoned
 * about: after a trainee re-pays following a revoked subscription,
 * `charge.success` clears the old subscription code (see that
 * handler's own comment), but there's still a real window before the
 * NEW `subscription.create` event arrives and records the new one. A
 * late, stale event from the OLD, already-superseded subscription
 * arriving in that window would otherwise fall through to the
 * customer+plan fallback and incorrectly act on a trainee's brand-new,
 * legitimately-paid access — confirmed live, not hypothetical.
 *
 * When true (the revoke-consequential events: subscription.disable,
 * subscription.not_renew), a subscription_code that's PRESENT but
 * doesn't match anything is treated as a strong staleness signal —
 * this almost certainly means the event is about a different,
 * superseded subscription, not a recording gap, so this returns null
 * rather than risk falling back onto the wrong enrollment. When false
 * (subscription.create, whose whole job is recording a code that
 * hasn't been seen before, and the lower-stakes invoice.payment_failed
 * notification), a mismatch is expected and the fallback still
 * applies.
 */
import { prisma } from "@/lib/prisma";

export async function findEnrollmentForSubscriptionEvent(
  data: Record<string, unknown>,
  strictCodeMatch: boolean
): Promise<{ id: string; courseId: string; traineeId: string } | null> {
  const subscriptionCode = typeof data.subscription_code === "string" ? data.subscription_code : null;
  if (subscriptionCode) {
    const byCode = await prisma.courseEnrollment.findUnique({
      where: { paystackSubscriptionCode: subscriptionCode },
      select: { id: true, courseId: true, traineeId: true },
    });
    if (byCode) return byCode;
    if (strictCodeMatch) return null;
  }

  const customerCode =
    typeof data.customer === "object" && data.customer !== null && "customer_code" in data.customer
      ? (data.customer as { customer_code: unknown }).customer_code
      : null;
  const planCode =
    typeof data.plan === "object" && data.plan !== null && "plan_code" in data.plan
      ? (data.plan as { plan_code: unknown }).plan_code
      : null;
  if (typeof customerCode !== "string" || typeof planCode !== "string") return null;

  const course = await prisma.course.findFirst({ where: { paystackPlanCode: planCode }, select: { id: true } });
  if (!course) return null;

  return prisma.courseEnrollment.findFirst({
    where: { courseId: course.id, paystackCustomerCode: customerCode },
    select: { id: true, courseId: true, traineeId: true },
  });
}
