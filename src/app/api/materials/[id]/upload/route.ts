import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedMaterial } from "@/lib/courseOwnership";
import { validateLessonMaterialFile, uploadLessonMaterial, deleteLessonMaterialBestEffort } from "@/lib/lessonMaterial";
import { notifyDownloadersOfMaterialChange } from "@/lib/notifications/materialChange";

/**
 * POST /api/materials/[id]/upload — replaces an existing PDF/DOCX/PPTX
 * material's file. Same upload-new-then-write-then-best-effort-delete-
 * old ordering as every other replace flow in this app (avatar, resume,
 * course flyer, ...), plus this feature's own genuinely new step: the
 * same trainee "material content changed" notification a URL edit
 * already triggers, since swapping the underlying file is exactly that
 * kind of change.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const existing = await requireOwnedMaterial(params.id, session.userId);

    if (existing.type === "VIDEO") {
      return NextResponse.json({ error: "Video materials are link-only — there's no file to upload." }, { status: 400 });
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
    }

    const title = formData.get("title");
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    }

    const validationError = validateLessonMaterialFile(existing.type as "PDF" | "DOCX" | "PPTX", file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const url = await uploadLessonMaterial(file, params.id);
    const updated = await prisma.material.update({
      where: { id: params.id },
      data: {
        url,
        ...(typeof title === "string" && title.trim().length >= 2 ? { title: title.trim() } : {}),
      },
    });

    await notifyDownloadersOfMaterialChange(params.id, updated.title, existing);
    await deleteLessonMaterialBestEffort(existing.url);

    return NextResponse.json(updated);
  });
}
