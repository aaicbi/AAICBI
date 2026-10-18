import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { sweepExpiredChallenges } from "@/lib/arena/arena";

/**
 * GET /api/cron/arena-sweep — settles Ayakbi Arena invitations that ran out unanswered (which also tells the people who sent them).
 * While people are using the app this happens by itself within seconds of an invitation lapsing; this daily job is the backstop for
 * a quiet day. Authenticated by CRON_SECRET like the other scheduled jobs; the answer is a count only.
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ settled: await sweepExpiredChallenges(true) });
  });
}
