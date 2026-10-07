import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { issueMemberInvite, requireTrainingOrgSession } from "@/lib/trainingOrgMembers";

const PatchSchema = z.object({ action: z.enum(["disable", "enable", "resend"]) });

/** Finds the member only if it belongs to the session's own organization. */
async function ownMember(id: string, organizationId: string) {
  return prisma.trainingOrganizationMember.findFirst({ where: { id, trainingOrganizationId: organizationId } });
}

/**
 * PATCH /api/org/members/[id] — disable, enable, or re-send the
 * invitation. Disabling stops new sign-ins; a session the member already
 * has open stays valid until it expires (the session carries the
 * organization's shared account, not a member id).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

    const member = await ownMember(params.id, org.id);
    if (!member) return NextResponse.json({ error: "Team member not found." }, { status: 404 });

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
