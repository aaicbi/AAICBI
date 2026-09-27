import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface RevenueFigure {
  revenueKobo: number;
  payerCount: number; // distinct trainees with a SUCCESS payment in the period
}

/**
 * Shared by the admin revenue tiles, the per-course payout table, and
 * the instructor's own payout view. "Distinct paying trainee count,"
 * not "count of Payment rows" — a trainee who retried after a failed
 * charge, or who somehow has two SUCCESS rows in one period, counts
 * once for FLAT_PER_SUBSCRIBER purposes, never twice.
 *
 * A recurring subscription's renewal charge creates its own `Payment`
 * row via the `charge.success` webhook, the same as a first payment
 * (confirmed by reading src/lib/paystack/reconcile.ts's own comment:
 * "both the first payment and every renewal") — so summing `SUCCESS`
 * rows by `confirmedAt` is an accurate revenue-per-period figure,
 * recurring courses included, with no separate subscription-status
 * logic needed here.
 */
export async function getRevenueForPeriod(
  courseFilter: Prisma.PaymentWhereInput,
  range: { from: Date; to: Date }
): Promise<RevenueFigure> {
  const where: Prisma.PaymentWhereInput = {
    ...courseFilter,
    status: "SUCCESS",
    confirmedAt: { gte: range.from, lt: range.to },
  };

  const [sum, distinctTrainees] = await Promise.all([
    prisma.payment.aggregate({ where, _sum: { amountKobo: true } }),
    prisma.payment.findMany({ where, select: { traineeId: true }, distinct: ["traineeId"] }),
  ]);

  return { revenueKobo: sum._sum.amountKobo ?? 0, payerCount: distinctTrainees.length };
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function startOfUtcYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

/** Parses a "YYYY-MM" string into the UTC [from, to) range for that month. */
export function monthRange(monthStr: string): { from: Date; to: Date } {
  const [y, m] = monthStr.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  return { from, to };
}

/**
 * `null` means "not configured yet" — deliberately distinct from 0, so
 * an unconfigured course never silently shows as "owes nothing."
 */
export function computePayoutKobo(
  course: { payoutType: "PERCENTAGE_OF_REVENUE" | "FLAT_PER_SUBSCRIBER" | null; payoutPercentage: number | null; payoutFlatRateKobo: number | null },
  figure: RevenueFigure
): number | null {
  if (course.payoutType === "PERCENTAGE_OF_REVENUE" && course.payoutPercentage != null) {
    return Math.round((figure.revenueKobo * course.payoutPercentage) / 100);
  }
  if (course.payoutType === "FLAT_PER_SUBSCRIBER" && course.payoutFlatRateKobo != null) {
    return figure.payerCount * course.payoutFlatRateKobo;
  }
  return null;
}
