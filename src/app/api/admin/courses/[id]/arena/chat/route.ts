import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { liftSuspension, moderationView, removeChatMessage, suspendPlayer } from "@/lib/arena/chat";
import { ArenaError } from "@/lib/arena/arena";

export const dynamic = "force-dynamic";

async function guard(courseId: string) {
  const s = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
  await requireOwnedCourse(courseId, s.userId, s.role);
  return s;
}

/** GET: the recent chat and the suspensions for one course, for the people who moderate it. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await guard(params.id);
    return NextResponse.json(await moderationView(params.id));
  });
}

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("remove"), messageId: z.string().min(1), reason: z.string().max(200).nullish() }),
  z.object({ action: z.literal("suspend"), traineeId: z.string().min(1), hours: z.number().int().min(1).max(24 * 90).nullable(), reason: z.string().max(200).nullish(), removeRecent: z.boolean().optional() }),
  z.object({ action: z.literal("lift"), suspensionId: z.string().min(1) }),
]);

/** POST: remove a message, suspend a player (for some hours, or until lifted), or lift a suspension. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const s = await guard(params.id);
    const parsed = Action.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose what to do." }, { status: 400 });
    const a = parsed.data;
    try {
      if (a.action === "remove") await removeChatMessage(params.id, a.messageId, s.userId, a.reason);
      else if (a.action === "suspend") await suspendPlayer(params.id, a.traineeId, s.userId, { hours: a.hours, reason: a.reason, removeRecent: a.removeRecent });
      else await liftSuspension(params.id, a.suspensionId, s.userId);
    } catch (e) {
      if (e instanceof ArenaError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    return NextResponse.json(await moderationView(params.id));
  });
}
