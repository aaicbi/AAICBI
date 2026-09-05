import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";

const EventSchema = z.object({
  eventType: z.enum(["tab_hidden", "window_blur", "fullscreen_exited", "page_left"]),
  metadata: z.record(z.unknown()).optional(),
});

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
        metadata: (parsed.data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ ok: true });
  });
}