/**
 * M26/M27 — computing the end of a paid course's current billing
 * period from its interval. Deliberately pure and synchronous, no
 * database, no network, so this is genuinely unit testable, the same
 * discipline as every other real decision function in this project.
 */
export function computePeriodEnd(from: Date, billingInterval: "MONTHLY" | "QUARTERLY" | "ANNUALLY"): Date {
  const result = new Date(from);
  switch (billingInterval) {
    case "MONTHLY":
      result.setMonth(result.getMonth() + 1);
      break;
    case "QUARTERLY":
      result.setMonth(result.getMonth() + 3);
      break;
    case "ANNUALLY":
      result.setFullYear(result.getFullYear() + 1);
      break;
  }
  return result;
}
