import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { validateResumeFile, uploadResume, deleteResumeBestEffort } from "@/lib/resume";

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    const validationError = validateResumeFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const existing = await prisma.trainee.findUnique({ where: { id: session.userId }, select: { resumeUrl: true } });
    const url = await uploadResume(file, `trainee-${session.userId}`);
    const trainee = await prisma.trainee.update({
      where: { id: session.userId },
      data: { resumeUrl: url, resumeUploadedAt: new Date() },
      select: { resumeUrl: true, resumeUploadedAt: true },
    });

    // Same ordering discipline as avatar upload — cleanup only after
    // the new upload and DB write both succeed.
    if (existing?.resumeUrl) {
      await deleteResumeBestEffort(existing.resumeUrl);
    }

    return NextResponse.json(trainee);
  });
}

export async function DELETE() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const existing = await prisma.trainee.findUnique({ where: { id: session.userId }, select: { resumeUrl: true } });
    const trainee = await prisma.trainee.update({
      where: { id: session.userId },
      data: { resumeUrl: null, resumeUploadedAt: null },
      select: { resumeUrl: true, resumeUploadedAt: true },
    });
    if (existing?.resumeUrl) {
      await deleteResumeBestEffort(existing.resumeUrl);
    }
    return NextResponse.json(trainee);
  });
}
