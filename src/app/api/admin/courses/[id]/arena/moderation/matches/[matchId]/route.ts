import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { ArenaError } from "@/lib/arena/arena";
import { matchLog } from "@/lib/arena/moderation";

export const dynamic = "force-dynamic";

/** GET: what the two players wrote to each other in one match, for the people who moderate the course. */
export async function GET(_req: NextRequest, { params }: { params: { id: string; matchId: string } }) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, s.userId, s.role);
    try {
      return NextResponse.json(await matchLog(params.id, params.matchId));
    } catch (e) {
      if (e instanceof ArenaError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}
