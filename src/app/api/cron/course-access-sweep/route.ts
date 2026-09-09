import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { expireAllLapsedEnrollments } from "@/lib/courseAccess";
import { sendDueAccessExpiryReminders } from "@/lib/enrollmentReminders";

/**
 * GET /api/cron/course-access-sweep — this project's first scheduled
 * job (see vercel.json), added specifically because expiry reminders
 * (task Section 13/14) genuinely can't be satisfied by the "check on
 * next touchpoint" pattern used everywhere else in this codebase (see
 * examEngine.ts's expireStaleAttemptsForTrainee and
 * jobPostingExpiry.ts's expireStaleJobPostings for that established
 * alternative, and courseAccess.ts's own comment on why it doesn't
 * apply here): a reminder has to reach a trainee BEFORE they visit, by
 * definition, and FIXED_DURATION courses have no Paystack webhook to
 * revoke lapsed access at all — this is their only real expiry path.
 *
 * Authenticated by `CRON_SECRET`, Vercel's own documented mechanism
 * for securing a cron endpoint (Vercel automatically sends
 * `Authorization: Bearer ${CRON_SECRET}` on its own scheduled
 * invocations) — deliberately not session/role-based, since nothing
 * about a scheduled job resembles a signed-in staff member's request.
 * A minimal response body (counts only), even though the caller is
 * already trusted — no reason to expose per-trainee detail here.
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    if (!secret || authHeader !== `Bearer ${secret}`) {
      // Deliberately the same generic 401 whether CRON_SECRET is unset
      // or the header is simply wrong — never confirm which, the same
      // "don't help an attacker debug which part failed" discipline the
      // Paystack webhook's own signature check already uses.
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const revokedCount = await expireAllLapsedEnrollments();
    const remindersSent = await sendDueAccessExpiryReminders();

    return NextResponse.json({ revokedCount, remindersSent });
  });
}
