import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";

const EventSchema = z.object({
  eventType: z.enum(["tab_hidden", "window_blur", "fullscreen_exited", "page_left"]),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Only called when the exam has monitoringEnabled=true (§21) — the
 * client should check that flag (returned at attempt start) before
 * wiring up visibilitychange/blur listeners at all, so exams without
 * monitoring don't pay any of this cost or raise privacy questions for
 * no reason. Per §21, don't oversell this: it records events for the
 * instructor to review, it doesn't prevent anything.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const body = await req.json();
    const parsed = EventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid event payload." }, { status: 400 });
    }
    await prisma.suspiciousEvent.create({
      data: {
        attemptId: params.id,
        eventType: parsed.data.eventType,
        metadata: parsed.data.metadata ?? {},
      },
    });
    return NextResponse.json({ ok: true });
  });
}
