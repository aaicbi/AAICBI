import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { validateAvatarFile, uploadAvatar, deleteAvatarBestEffort } from "@/lib/avatar";

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
