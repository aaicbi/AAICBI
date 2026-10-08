import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { loadGuideConfig } from "@/lib/guide/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/guide/config — public. The switch, the written answers and the
 * skill names, everything Loop needs to answer in the browser. Contains
 * nothing about any person. Cached briefly at the edge, so a switch change
 * reaches visitors within a minute.
 */
export async function GET() {
  return withApiErrors(async () => {
    const config = await loadGuideConfig();
    return NextResponse.json(config, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  });
}
