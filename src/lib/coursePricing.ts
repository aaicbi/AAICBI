/**
 * Post-M15 milestone audit finding: Course.isFree and Course.priceKobo
 * had no cross-field validation at all when this was first shipped —
 * the schema comment on Course said this was "the application layer's
 * job," but no application code actually did it. Concretely risky
 * moment this closes: an admin creating a paid course and forgetting
 * to set a price, which would otherwise go uncaught until M26 tries to
 * initialize a Paystack transaction with a missing amount.
 *
 * A shared function, not duplicated Zod refinements in both the create
 * and update routes — the rule is genuinely one rule, and drift
 * between two copies of "what counts as consistent pricing" is exactly
 * the kind of bug that's invisible until the one route nobody updated
 * gets hit.
 *
 * M26 — extended to billingInterval, the same real gap this function
 * already existed to close, now applying to the second field a paid
 * course genuinely can't do without: Paystack's Plan resource requires
 * a fixed interval, so a paid course missing one would fail exactly
 * the same way — uncaught until payment initiation actually tries it.
 *
 * Course enrollment/subscription system — extended again for the new
 * `accessModel` axis. Fourth parameter is optional and defaults to
 * `RECURRING_SUBSCRIPTION` with no duration fields, so every existing
 * 3-argument call site (and every existing test) keeps behaving
 * exactly as before with zero changes required. A free course still
 * can't carry any of the new fields either — a free course's access
 * simply never expires (see CourseEnrollment.currentPeriodEnd staying
 * null for the FREE enroll path), so a duration/reminder config on it
 * would be dead configuration nobody could ever observe taking effect.
 */
export function validateCoursePricing(
  isFree: boolean,
  priceKobo: number | null | undefined,
  billingInterval: string | null | undefined,
  accessConfig?: {
    accessModel?: string | null;
    accessDurationValue?: number | null;
    accessDurationUnit?: string | null;
    reminderEnabled?: boolean | null;
  }
): string | null {
  const accessModel = accessConfig?.accessModel ?? "RECURRING_SUBSCRIPTION";
  const accessDurationValue = accessConfig?.accessDurationValue;
  const accessDurationUnit = accessConfig?.accessDurationUnit;
  const reminderEnabled = accessConfig?.reminderEnabled ?? false;

  if (isFree) {
    if (priceKobo != null) {
      return "A free course can't have a price set — clear the price, or mark the course as paid instead.";
    }
    if (billingInterval != null) {
      return "A free course can't have a billing interval set — clear it, or mark the course as paid instead.";
    }
    if (accessDurationValue != null || accessDurationUnit != null) {
      return "A free course can't have an access duration set — a free course's access never expires.";
    }
    if (reminderEnabled) {
      return "A free course can't have expiry reminders enabled — it never expires.";
    }
    return null;
  }
  if (priceKobo == null || priceKobo <= 0) {
    return "A paid course needs a price greater than zero.";
  }

  if (accessModel === "RECURRING_SUBSCRIPTION") {
    if (billingInterval == null) {
      return "A paid course needs a billing interval (monthly, quarterly, or annually).";
    }
    if (accessDurationValue != null || accessDurationUnit != null) {
      return "A recurring-subscription course can't also have a fixed access duration set — choose one access model.";
    }
    if (reminderEnabled) {
      return "Expiry reminders are only available for fixed-duration access courses — a recurring subscription already sends its own renewal/expiry emails.";
    }
    return null;
  }

  // FIXED_DURATION
  if (billingInterval != null) {
    return "A fixed-duration course can't also have a billing interval set — choose one access model.";
  }
  if (accessDurationUnit == null) {
    return "A fixed-duration course needs an access duration (days, months, or lifetime).";
  }
  if (accessDurationUnit === "LIFETIME") {
    if (accessDurationValue != null) {
      return "A lifetime access duration shouldn't also have a numeric value set.";
    }
    return null;
  }
  if (accessDurationValue == null || accessDurationValue <= 0) {
    return "A fixed-duration course needs a positive access duration value.";
  }
  return null;
}
