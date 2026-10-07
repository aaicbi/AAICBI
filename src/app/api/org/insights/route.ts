import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";
import { getOrgInsights } from "@/lib/ecosystem/insights";

export const dynamic = "force-dynamic";

/** GET /api/org/insights — the signed-in organization's own numbers; the organization comes from the session, never the request. */
export async function GET() {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    return NextResponse.json(await getOrgInsights(org));
  });
}
