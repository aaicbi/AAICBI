import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { practiceOverview } from "@/lib/quest/server";

/**
 * GET /api/modules/[id]/practice — the trainee's practice overview for one
 * module: mastery per objective, XP, streak, level, and whether the formal
 * assessment is unlocked. Same access rules as starting the assessment
 * (enrolled, module unlocked) plus the instructor's practice switch.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    return NextResponse.json(await practiceOverview(session.userId, params.id));
  });
}
