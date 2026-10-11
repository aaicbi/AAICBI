import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { requireRole } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/profiles/profiles";

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
    // The same follow, in the follow graph the feed and profiles use.
    const [me, theirs] = await Promise.all([ensureProfile("PERSON", traineeId), ensureProfile("TRAINING_ORG", org.id)]);
    if (me && theirs) await prisma.follow.upsert({ where: { followerProfileId_followedProfileId: { followerProfileId: me.id, followedProfileId: theirs.id } }, update: {}, create: { followerProfileId: me.id, followedProfileId: theirs.id } });
    return NextResponse.json({ following: true });
  });
}

export async function DELETE(_req: Request, { params }: { params: { orgId: string } }) {
  return withApiErrors(async () => {
    const traineeId = await requireTrainee();
    await prisma.organizationFollow.deleteMany({ where: { traineeId, trainingOrganizationId: params.orgId } });
    const [me, theirs] = await Promise.all([ensureProfile("PERSON", traineeId), ensureProfile("TRAINING_ORG", params.orgId)]);
    if (me && theirs) await prisma.follow.deleteMany({ where: { followerProfileId: me.id, followedProfileId: theirs.id } });
    return NextResponse.json({ following: false });
  });
}
