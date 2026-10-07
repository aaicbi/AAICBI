import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";
import { EventSchema, startsTooEarly } from "@/lib/ecosystem/eventCore";

export const dynamic = "force-dynamic";

const SELECT = { id: true, title: true, description: true, startsAt: true, endsAt: true, locationText: true, registrationUrl: true, status: true } as const;

/** GET /api/org/events — this organization's own published events, soonest first. */
export async function GET() {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    const events = await prisma.organizationEvent.findMany({
      where: { trainingOrganizationId: org.id, status: "PUBLISHED" },
      orderBy: { startsAt: "desc" },
      take: 100,
      select: SELECT,
    });
    return NextResponse.json(events);
  });
}

/** POST /api/org/events — publish an event. The organization comes from the session. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    const limited = await rateLimit(`org-event:${org.id}`, 20, 24 * 3600 * 1000);
    if (!limited.allowed) return NextResponse.json({ error: "You have added a lot of events today. Try again tomorrow." }, { status: 429 });
    const parsed = EventSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the event details." }, { status: 400 });
    if (startsTooEarly(parsed.data.startsAt)) return NextResponse.json({ error: "The start date is in the past." }, { status: 400 });
    const event = await prisma.organizationEvent.create({ data: { ...parsed.data, trainingOrganizationId: org.id }, select: SELECT });
    return NextResponse.json(event, { status: 201 });
  });
}
