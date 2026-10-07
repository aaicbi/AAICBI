import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { requireRole } from "@/lib/auth/session";

async function requireTrainee() {
  const session = await requireRole("TRAINEE");
  const limited = await rateLimit(`org-follow:${session.userId}`, 60, 60 * 1000);
  if (!limited.allowed) {
    const err = new Error("Slow down a little.") as Error & { status?: number };
    err.status = 429;
    throw err;
  }
  return session.userId;
}

/** POST /api/trainee/org-follows/[orgId] — follow an organization that has a public page. */
export async function POST(_req: Request, { params }: { params: { orgId: string } }) {
  return withApiErrors(async () => {
    const traineeId = await requireTrainee();
    const org = await prisma.trainingOrganization.findFirst({
      where: { id: params.orgId, approvalState: "APPROVED", publicProfile: { is: { publicEnabled: true } } },
      select: { id: true },
    });
    if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    await prisma.organizationFollow.upsert({
      where: { traineeId_trainingOrganizationId: { traineeId, trainingOrganizationId: org.id } },
      update: {},
      create: { traineeId, trainingOrganizationId: org.id },
    });
    return NextResponse.json({ following: true });
  });
}

export async function DELETE(_req: Request, { params }: { params: { orgId: string } }) {
  return withApiErrors(async () => {
    const traineeId = await requireTrainee();
    await prisma.organizationFollow.deleteMany({ where: { traineeId, trainingOrganizationId: params.orgId } });
    return NextResponse.json({ following: false });
  });
}
