import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { issueMemberInvite, requireTrainingOrgSession, unusablePasswordHash } from "@/lib/trainingOrgMembers";

const CreateSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

/**
 * GET/POST /api/org/members — a training organization's teammates.
 * Scoped to the signed-in session's own organization on the server.
 * Creating a member emails an invitation link; the member sets their own
 * password, so no one else ever knows it.
 */
export async function GET() {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    const members = await prisma.trainingOrganizationMember.findMany({
      where: { trainingOrganizationId: org.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, disabledAt: true, lastLoginAt: true, createdAt: true, setupToken: true, passwordHash: false },
    });
    return NextResponse.json({
      owner: { name: org.contactName, email: org.email, lastLoginAt: org.lastLoginAt },
      members: members.map(({ setupToken, ...m }) => ({ ...m, invitePending: setupToken !== null })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();

    // Invitations send email; cap them so the form cannot be used to spam.
    const limited = await rateLimit(`org-member-invite:${org.id}`, 20, 60 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json({ error: "Too many invitations. Try again in an hour." }, { status: 429 });
    }

    const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Check the details and try again.";
      return NextResponse.json({ error: first }, { status: 400 });
    }

    const { name, email } = parsed.data;
    const [orgWithEmail, memberWithEmail] = await Promise.all([
      prisma.trainingOrganization.findUnique({ where: { email }, select: { id: true } }),
      prisma.trainingOrganizationMember.findUnique({ where: { email }, select: { id: true } }),
    ]);
    if (orgWithEmail || memberWithEmail) {
      return NextResponse.json({ error: "That email is already used by an account." }, { status: 409 });
    }

    const member = await prisma.trainingOrganizationMember.create({
      data: { trainingOrganizationId: org.id, name, email, passwordHash: await unusablePasswordHash() },
      select: { id: true, name: true, email: true },
    });
    const setupUrl = await issueMemberInvite(member, org.name);
    // The link is returned too, so the owner can share it by hand if
    // the email does not arrive.
    return NextResponse.json({ member, setupUrl }, { status: 201 });
  });
}
