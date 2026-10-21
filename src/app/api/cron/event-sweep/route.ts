import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { runEventSweep } from "@/lib/events/eventsReminders";

/**
 * GET /api/cron/event-sweep — hourly: publishes approved events whose publication time has come and sends each event reminder once.
 * Authenticated by CRON_SECRET like the other scheduled jobs; the answer is counts only.
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await runEventSweep());
  });
}
