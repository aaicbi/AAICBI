import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";

export const dynamic = "force-dynamic";

/** DELETE /api/org/events/[id] — take down one of this organization's own events (another organization's id is a 404). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    const res = await prisma.organizationEvent.updateMany({ where: { id: params.id, trainingOrganizationId: org.id }, data: { status: "REMOVED" } });
    if (res.count === 0) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    return NextResponse.json({ removed: true });
  });
}
