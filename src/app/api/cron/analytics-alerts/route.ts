import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { checkAndSendAlerts } from "@/lib/analytics/alerts";

/**
 * GET /api/cron/analytics-alerts — Analytics System Phase 4. A second,
 * separate cron entry (see vercel.json) rather than folding this into
 * the existing course-access-sweep job — that one's concern (lapsed
 * access, expiry reminders) is unrelated to analytics alerting, and
 * conflating the two would make either harder to reason about in
 * isolation. Identical CRON_SECRET bearer-auth pattern as that
 * existing route.
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await checkAndSendAlerts();
    return NextResponse.json(result);
  });
}
