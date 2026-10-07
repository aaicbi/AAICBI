import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { getPlatformAnalytics } from "@/lib/ecosystem/insights";

export const dynamic = "force-dynamic";

/** GET /api/admin/ecosystem/analytics — SUPER_ADMIN, platform-wide totals (demo organizations excluded). */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    return NextResponse.json(await getPlatformAnalytics());
  });
}
