import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { processMessages } from "@/lib/growth/messaging";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/growth-messages — hourly: queues the follow-up messages that have come due for people who saved their taster score, and sends
 * them (or leaves them for the Super Admin to send by hand, depending on the channel). Does nothing while messaging is switched off, and
 * sends nothing in quiet hours. Authenticated by CRON_SECRET like the other scheduled jobs; the answer is counts only.
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await processMessages());
  });
}
