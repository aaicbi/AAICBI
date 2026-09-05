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
 */
export function validateCoursePricing(
  isFree: boolean,
  priceKobo: number | null | undefined,
  billingInterval: string | null | undefined
): string | null {
  if (isFree) {
    if (priceKobo != null) {
      return "A free course can't have a price set — clear the price, or mark the course as paid instead.";
    }
    if (billingInterval != null) {
      return "A free course can't have a billing interval set — clear it, or mark the course as paid instead.";
    }
    return null;
  }
  if (priceKobo == null || priceKobo <= 0) {
    return "A paid course needs a price greater than zero.";
  }
  if (billingInterval == null) {
    return "A paid course needs a billing interval (monthly, quarterly, or annually).";
  }
  return null;
}
