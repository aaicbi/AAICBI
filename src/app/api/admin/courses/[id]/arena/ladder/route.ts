import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { ArenaError } from "@/lib/arena/arena";
import { adminLadder, setLadderHidden } from "@/lib/arena/ladder";

export const dynamic = "force-dynamic";

async function guard(courseId: string) {
  const s = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
  await requireOwnedCourse(courseId, s.userId, s.role);
  return s;
}

/** GET: the course's ladder players (including hidden ones), for the people who moderate it. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await guard(params.id);
    return NextResponse.json(await adminLadder(params.id));
  });
}

const Body = z.object({ action: z.enum(["hide", "show"]), traineeId: z.string().min(1) });

/** POST: take a player off the ladder, or put them back. Their rating is kept. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await guard(params.id);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a player." }, { status: 400 });
    try {
      await setLadderHidden(params.id, parsed.data.traineeId, parsed.data.action === "hide");
    } catch (e) {
      if (e instanceof ArenaError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    return NextResponse.json(await adminLadder(params.id));
  });
}
