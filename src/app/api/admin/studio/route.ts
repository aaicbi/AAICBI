import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { studioOverview } from "@/lib/quest/studio";

/** GET /api/admin/studio — the game library and every course's modules with what is assigned. Super Admin only. */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    return NextResponse.json(await studioOverview());
  });
}
