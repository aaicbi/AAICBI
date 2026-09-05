/**
 * M45 — the automatic grant-on-subscription wiring, the last real
 * piece of this milestone's original scope. Called from
 * `processConfirmedCharge` on every successful paid charge — both a
 * trainee's first payment and every subsequent renewal — matching the
 * word "subscription" in this milestone's own description: credits
 * refresh each billing cycle, the same way the underlying subscription
 * itself does, not a one-time grant that never recurs.
 *
 * `grantedById: null` here specifically — the same field already
 * designed for exactly this distinction from a real admin adjustment
 * (see the schema comment on AiCreditGrant): this is the system
 * acting on a genuine payment event, not a person making a judgment
 * call.
 */
import { prisma } from "@/lib/prisma";

/** Default plus optional per-course override — the exact same shape
 * as every other admin-configurable setting in this project. The
 * singleton is fetched, not assumed to exist — a platform that's
 * never had anyone visit /admin/platform-settings should still work
 * correctly with the schema's own default (0), not throw over a row
 * that was never created. A real, standalone function — not inlined
 * into the caller — specifically so its return type is a clean,
 * definite `number`, not a mutable outer variable TypeScript's
 * control-flow narrowing struggles to track correctly across an async
 * transaction closure. */
async function resolveAllowance(courseId: string): Promise<number | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { aiCreditAllowanceOverride: true },
  });
  if (!course) return null;
  if (course.aiCreditAllowanceOverride !== null) return course.aiCreditAllowanceOverride;
  const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  return settings?.defaultAiCreditAllowance ?? 0;
}

export async function grantAiCreditsForPayment(traineeId: string, courseId: string): Promise<void> {
  let allowance: number | null = null;
  try {
    allowance = await resolveAllowance(courseId);
    if (allowance === null || allowance <= 0) return; // no course found, or a real, valid, opt-out state — either way, not an error

    const grantAmount = allowance;
    await prisma.$transaction(async (tx: any) => {
      await tx.aiCreditGrant.create({
        data: { traineeId, amount: grantAmount, reason: `Automatic grant — paid enrollment in course ${courseId}` },
      });
      await tx.trainee.update({
        where: { id: traineeId },
        data: { aiCreditBalance: { increment: grantAmount } },
      });
    });
    console.log(`Granted ${grantAmount} AI credit(s) to trainee ${traineeId} for course ${courseId}.`);
  } catch (e) {
    // Audit finding, fixed here: this used to log a bare error with no
    // way to recover. The real risk is genuine, not hypothetical — by
    // the time this runs, the PaystackEvent idempotency row for this
    // exact charge already exists (created before processConfirmedCharge
    // was even called), so a transient failure here — a momentary DB
    // blip, nothing to do with the payment itself — permanently blocks
    // any future retry of this same reference from ever reaching this
    // code again. Neither a webhook retry nor a trainee clicking
    // "recheck my payment" would help; both would just see "already
    // processed" and stop. The recovery mechanism already exists (the
    // admin credit-adjustment route), so what was actually missing was
    // making a rare failure here loud and actionable enough for staff
    // to use it — the same "ACTION NEEDED" pattern already established
    // for M27's subscription.disable correlation failure, the other
    // place this project treats a silent miss as unacceptable. The
    // allowance amount is included whenever it was successfully
    // computed before the failure, so staff have the exact number to
    // grant manually without needing to re-derive it.
    const amountNote = allowance !== null ? `${allowance} credit(s)` : "an unknown amount (failed before the allowance could be computed)";
    console.error(
      `ACTION NEEDED: AI credit grant failed for trainee ${traineeId}, course ${courseId} — this payment will never automatically retry. Manually grant ${amountNote} via the admin credit-adjustment route if appropriate.`,
      e
    );
  }
}
