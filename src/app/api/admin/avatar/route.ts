import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { validateAvatarFile, uploadAvatar, deleteAvatarBestEffort } from "@/lib/avatar";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { setOrganizationPicture } from "@/lib/orgPicture";

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    const validationError = validateAvatarFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { id: session.userId }, select: { avatarUrl: true } });
    const url = await uploadAvatar(file, `staff-${session.userId}`);
    // For a training organization the profile picture is the organization's picture too: it is what visitors see on its public page.
    const org = session.role === "ADMIN" ? await findTrainingOrgByStaffUserId(session.userId) : null;
    if (org) {
      const replaced = await setOrganizationPicture(org.id, session.userId, url);
      await Promise.all(replaced.map((u) => deleteAvatarBestEffort(u)));
      return NextResponse.json({ avatarUrl: url });
    }
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: { avatarUrl: url },
      select: { avatarUrl: true },
    });

    if (existing?.avatarUrl) {
      await deleteAvatarBestEffort(existing.avatarUrl);
    }

    return NextResponse.json(user);
  });
}

export async function DELETE() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const org = session.role === "ADMIN" ? await findTrainingOrgByStaffUserId(session.userId) : null;
    if (org) {
      const replaced = await setOrganizationPicture(org.id, session.userId, null);
      await Promise.all(replaced.map((u) => deleteAvatarBestEffort(u)));
      return NextResponse.json({ avatarUrl: null });
    }
    const existing = await prisma.user.findUnique({ where: { id: session.userId }, select: { avatarUrl: true } });
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: { avatarUrl: null },
      select: { avatarUrl: true },
    });
    if (existing?.avatarUrl) {
      await deleteAvatarBestEffort(existing.avatarUrl);
    }
    return NextResponse.json(user);
  });
}
