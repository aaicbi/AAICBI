import { NextResponse } from "next/server";
import { requireStudioUser, requireStudioGame, requireStudioModule, requireStudioCan } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { studioOverview } from "@/lib/quest/studio";
import { resultsShared } from "@/lib/quest/results";

export const dynamic = "force-dynamic";

/** GET /api/admin/studio — the game library and every course's modules with what is assigned. Super Admin only. */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioCan(session, "gaming_studio.configs:view");
    const canSeeResults = session.isSuper || (session.permissions.includes("GAME_RESULTS") && (await resultsShared()));
    return NextResponse.json({ ...(await studioOverview(session)), canSeeResults });
  });
}
