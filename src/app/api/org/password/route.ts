import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";

const Schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(200),
  newPassword: z.string().min(8, "Use at least 8 characters for the new password.").max(200),
});

/**
 * POST /api/org/password: whoever is signed in to a training organization (the owner, or a teammate of any role)
 * changes their own password. It is deliberately not tied to a role: every person may change their own password,
 * including a Viewer. The session email says whose password it is. The current password must be right.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await getSession();
    const org = session && session.role === "ADMIN" ? await findTrainingOrgByStaffUserId(session.userId) : null;
    if (!session || !org) return NextResponse.json({ error: "This is for training organizations." }, { status: 403 });
    const limited = await rateLimit(`org-change-password:${session.userId}:${session.email}`, 5, 15 * 60 * 1000);
    if (!limited.allowed) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
    const parsed = Schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the details and try again." }, { status: 400 });

    const isOwner = org.email.toLowerCase() === session.email.toLowerCase();
    const member = isOwner ? null : await prisma.trainingOrganizationMember.findUnique({ where: { email: session.email }, select: { id: true, passwordHash: true, disabledAt: true, trainingOrganizationId: true } });
    if (!isOwner && (!member || member.disabledAt || member.trainingOrganizationId !== org.id)) {
      return NextResponse.json({ error: "We could not find your account." }, { status: 404 });
    }
    const currentHash = isOwner ? org.passwordHash : (member as NonNullable<typeof member>).passwordHash;
    if (!(await verifyPassword(parsed.data.currentPassword, currentHash))) {
      return NextResponse.json({ error: "Your current password is not right." }, { status: 400 });
    }
    if (parsed.data.newPassword === parsed.data.currentPassword) {
      return NextResponse.json({ error: "Choose a password that is different from the current one." }, { status: 400 });
    }
    const passwordHash = await hashPassword(parsed.data.newPassword);
    if (isOwner) await prisma.trainingOrganization.update({ where: { id: org.id }, data: { passwordHash, resetToken: null, resetTokenExpiresAt: null } });
    else await prisma.trainingOrganizationMember.update({ where: { id: (member as NonNullable<typeof member>).id }, data: { passwordHash, setupToken: null, setupTokenExpiresAt: null } });
    return NextResponse.json({ ok: true });
  });
}
