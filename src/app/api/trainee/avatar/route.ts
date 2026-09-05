import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { validateAvatarFile, uploadAvatar, deleteAvatarBestEffort } from "@/lib/avatar";

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    const validationError = validateAvatarFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const existing = await prisma.trainee.findUnique({ where: { id: session.userId }, select: { avatarUrl: true } });
    const url = await uploadAvatar(file, `trainee-${session.userId}`);
    const trainee = await prisma.trainee.update({
      where: { id: session.userId },
      data: { avatarUrl: url },
      select: { avatarUrl: true },
    });

    // Cleanup happens AFTER the new upload and DB update succeed, not
    // before — if the old blob were deleted first and the new upload
    // then failed, the trainee would be left with no avatar at all.
    // Worst case with this ordering is a briefly orphaned old blob if
    // the delete itself fails, which deleteAvatarBestEffort already
    // treats as non-fatal.
    if (existing?.avatarUrl) {
      await deleteAvatarBestEffort(existing.avatarUrl);
    }

    return NextResponse.json(trainee);
  });
}

export async function DELETE() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const existing = await prisma.trainee.findUnique({ where: { id: session.userId }, select: { avatarUrl: true } });
    const trainee = await prisma.trainee.update({
      where: { id: session.userId },
      data: { avatarUrl: null },
      select: { avatarUrl: true },
    });
    if (existing?.avatarUrl) {
      await deleteAvatarBestEffort(existing.avatarUrl);
    }
    return NextResponse.json(trainee);
  });
}
