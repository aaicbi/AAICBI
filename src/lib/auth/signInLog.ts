import { prisma } from "@/lib/prisma";

export type StaffSignInOutcome = "SUCCESS" | "BAD_CREDENTIALS" | "INACTIVE" | "RATE_LIMITED";

/**
 * Records a staff sign-in attempt. It must never get in the way of signing in, so a failure to write is swallowed.
 * The user agent is cut short; nothing else about the request is kept.
 */
export async function recordStaffSignIn(entry: { email: string; userId?: string | null; outcome: StaffSignInOutcome; ip?: string | null; userAgent?: string | null }): Promise<void> {
  try {
    await prisma.staffSignInLog.create({
      data: { email: entry.email.toLowerCase().slice(0, 254), userId: entry.userId ?? null, outcome: entry.outcome, ip: entry.ip?.slice(0, 64) ?? null, userAgent: entry.userAgent?.slice(0, 200) ?? null },
    });
  } catch {
    // A logging problem must not turn into a sign-in problem.
  }
}
