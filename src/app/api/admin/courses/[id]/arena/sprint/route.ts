import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { ArenaError } from "@/lib/arena/arena";
import { availabilityForCourse } from "@/lib/arena/config";
import { closeSprint, recentSprints, sprintPool, startSprint } from "@/lib/arena/sprint";

export const dynamic = "force-dynamic";

async function guard(courseId: string) {
  const s = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
  await requireOwnedCourse(courseId, s.userId, s.role);
  return s;
}

/** GET ?q= — whether Fastest Fingers is on, the recent questions, and course questions an instructor can pick from. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await guard(params.id);
    const q = req.nextUrl.searchParams.get("q")?.trim() || null;
    const [avail, recent, pool] = await Promise.all([availabilityForCourse(params.id), recentSprints(params.id), sprintPool(params.id, q)]);
    return NextResponse.json({ on: avail.fastest, recent, pool });
  });
}

const Action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    points: z.number().int().min(1).max(100).optional(),
    explanation: z.string().max(500).nullish(),
    questionId: z.string().min(1).optional(),
    custom: z.object({ text: z.string().min(1).max(500), options: z.array(z.string().max(200)).min(2).max(6), correctIndex: z.number().int().min(0).max(5) }).optional(),
  }),
  z.object({ action: z.literal("close"), sprintId: z.string().min(1) }),
]);

/** POST: post a question in the course chat, or close the open one. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const s = await guard(params.id);
    const parsed = Action.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Pick a question or write one, with 2 to 6 answers." }, { status: 400 });
    const a = parsed.data;
    try {
      if (a.action === "start") await startSprint(params.id, s.userId, a);
      else await closeSprint(params.id, a.sprintId);
    } catch (e) {
      if (e instanceof ArenaError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    return NextResponse.json({ on: true, recent: await recentSprints(params.id), pool: [] });
  });
}
