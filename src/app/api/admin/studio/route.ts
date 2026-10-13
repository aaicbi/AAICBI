import { NextResponse } from "next/server";
import { requireStudioUser, requireStudioGame, requireStudioModule } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { studioOverview } from "@/lib/quest/studio";

/** GET /api/admin/studio — the game library and every course's modules with what is assigned. Super Admin only. */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    return NextResponse.json(await studioOverview(session));
  });
}
