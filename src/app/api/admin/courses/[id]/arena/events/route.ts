import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { ArenaError } from "@/lib/arena/arena";
import { adminEvents, cancelEvent, createEvent, removeEventPlayer, startEvent, walkover } from "@/lib/arena/event";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function guard(courseId: string) {
  const s = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
  await requireOwnedCourse(courseId, s.userId, s.role);
  return s;
}

/** GET: whether live events are on for this course, and its recent events. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await guard(params.id);
    return NextResponse.json(await adminEvents(params.id));
  });
}

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().min(1).max(80), questionsPerMatch: z.number().int().min(4).max(30).optional(), moduleId: z.string().min(1).nullish() }),
  z.object({ action: z.literal("start"), eventId: z.string().min(1) }),
  z.object({ action: z.literal("cancel"), eventId: z.string().min(1) }),
  z.object({ action: z.literal("remove"), eventId: z.string().min(1), traineeId: z.string().min(1) }),
  z.object({ action: z.literal("walkover"), eventId: z.string().min(1), tieId: z.string().min(1), winnerId: z.string().min(1) }),
]);

/** POST: open an event, start it, cancel it, remove a player before it starts, or settle a pairing by walkover. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const s = await guard(params.id);
    const parsed = Action.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Give the event a name." }, { status: 400 });
    const a = parsed.data;
    try {
      if (a.action === "create") await createEvent(params.id, s.userId, { name: a.name, questionsPerMatch: a.questionsPerMatch, moduleId: a.moduleId ?? null });
      else {
        const own = await prisma.arenaEvent.findFirst({ where: { id: a.eventId, courseId: params.id }, select: { id: true } });
        if (!own) throw new ArenaError("That event could not be found.", 404);
        if (a.action === "start") await startEvent(a.eventId);
        else if (a.action === "cancel") await cancelEvent(a.eventId);
        else if (a.action === "remove") await removeEventPlayer(a.eventId, a.traineeId);
        else await walkover(a.eventId, a.tieId, a.winnerId);
      }
    } catch (e) {
      if (e instanceof ArenaError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    return NextResponse.json(await adminEvents(params.id));
  });
}
