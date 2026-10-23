import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { processScheduledEmails } from "@/lib/crm/email";

export const dynamic = "force-dynamic";

/** GET /api/cron/crm-email — hourly: sends the scheduled CRM emails that have come due, checking consent again at send time. Counts only. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await processScheduledEmails());
  });
}
