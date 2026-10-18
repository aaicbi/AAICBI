import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { ArenaError } from "@/lib/arena/arena";
import { eventView } from "@/lib/arena/event";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET: the event as the big screen shows it (no viewer, the whole bracket). */
export async function GET(_req: NextRequest, { params }: { params: { id: string; eventId: string } }) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, s.userId, s.role);
    const own = await prisma.arenaEvent.findFirst({ where: { id: params.eventId, courseId: params.id }, select: { id: true } });
    if (!own) throw new ArenaError("That event could not be found.", 404);
    return NextResponse.json(await eventView(params.eventId, null));
  });
}
