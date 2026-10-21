import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { isMemberRole } from "@/lib/org/people";
import { ownCourseIds } from "@/lib/org/memberCourses";
import { issueMemberInvite, requireTrainingOrgSession } from "@/lib/trainingOrgMembers";

const PatchSchema = z.union([z.object({ action: z.enum(["disable", "enable", "resend"]) }), z.object({ action: z.literal("role"), role: z.string().refine(isMemberRole, "Choose admin, instructor, editor or viewer.") }), z.object({ action: z.literal("courses"), courseIds: z.array(z.string().min(1)).max(200) })]);

/** Finds the member only if it belongs to the session's own organization. */
async function ownMember(id: string, organizationId: string) {
  return prisma.trainingOrganizationMember.findFirst({ where: { id, trainingOrganizationId: organizationId } });
}

/**
 * PATCH /api/org/members/[id] — disable, enable, or re-send the
 * invitation, or change their role. Disabling and role changes take effect on the very next request: the person behind
 * a session is looked up every time (see src/lib/org/actor.ts), so an open session does not outlast them.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

    const member = await ownMember(params.id, org.id);
    if (!member) return NextResponse.json({ error: "Team member not found." }, { status: 404 });

    if (parsed.data.action === "courses") {
      if (member.role !== "INSTRUCTOR") return NextResponse.json({ error: "Only instructors are given courses." }, { status: 400 });
      const ids = await ownCourseIds(org.staffUserId, parsed.data.courseIds);
      await prisma.$transaction([
        prisma.trainingOrganizationMemberCourse.deleteMany({ where: { memberId: member.id } }),
        prisma.trainingOrganizationMemberCourse.createMany({ data: ids.map((courseId) => ({ memberId: member.id, courseId })) }),
      ]);
      return NextResponse.json({ ok: true, courseIds: ids });
    }
    if (parsed.data.action === "role") {
      await prisma.trainingOrganizationMember.update({ where: { id: member.id }, data: { role: parsed.data.role } });
      return NextResponse.json({ ok: true });
    }
    if (parsed.data.action === "disable") {
      await prisma.trainingOrganizationMember.update({ where: { id: member.id }, data: { disabledAt: new Date(), setupToken: null, setupTokenExpiresAt: null } });
      return NextResponse.json({ ok: true });
    }
    if (parsed.data.action === "enable") {
      await prisma.trainingOrganizationMember.update({ where: { id: member.id }, data: { disabledAt: null } });
      return NextResponse.json({ ok: true });
    }

    const limited = await rateLimit(`org-member-invite:${org.id}`, 20, 60 * 60 * 1000);
    if (!limited.allowed) return NextResponse.json({ error: "Too many invitations. Try again in an hour." }, { status: 429 });
    if (member.disabledAt) return NextResponse.json({ error: "Enable this person before sending an invitation." }, { status: 400 });
    const setupUrl = await issueMemberInvite(member, org.name);
    return NextResponse.json({ ok: true, setupUrl });
  });
}

/** DELETE /api/org/members/[id] — removes a teammate's sign-in entirely. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    const member = await ownMember(params.id, org.id);
    if (!member) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
    await prisma.trainingOrganizationMember.delete({ where: { id: member.id } });
    return NextResponse.json({ ok: true });
  });
}
