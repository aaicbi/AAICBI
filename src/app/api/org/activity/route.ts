import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";

export const dynamic = "force-dynamic";

/** GET — what the people in this organization changed lately (the latest 200). Owners and managers only. */
export async function GET() {
  return withApiErrors(async () => {
    const { session, org } = await requireTrainingOrgSession();
    if (session.actor && !["OWNER", "MANAGER"].includes(session.actor.role)) return NextResponse.json({ error: "Only the owner or a manager can see the activity." }, { status: 403 });
    const rows = await prisma.orgActivity.findMany({ where: { orgUserId: org.staffUserId ?? session.userId }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, actorName: true, actorType: true, action: true, createdAt: true } });
    return NextResponse.json({ activity: rows });
  });
}
