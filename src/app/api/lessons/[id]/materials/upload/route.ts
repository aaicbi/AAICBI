import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedLesson } from "@/lib/courseOwnership";
import { validateLessonMaterialFile, uploadLessonMaterial } from "@/lib/lessonMaterial";

const UPLOADABLE_TYPES = new Set(["PDF", "DOCX", "PPTX"]);

/**
 * POST /api/lessons/[id]/materials/upload — the file-upload counterpart
 * to the JSON-body POST /api/lessons/[id]/materials, for admins who
 * have an actual PDF/DOCX/PPTX on their machine rather than a link to
 * one already hosted somewhere. VIDEO stays link-only (POST .../materials)
 * — there's no file to host for a YouTube/Drive video.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedLesson(params.id, session.userId);

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
    }

    const type = formData.get("type");
    const title = formData.get("title");
    const file = formData.get("file");

    if (typeof type !== "string" || !UPLOADABLE_TYPES.has(type)) {
      return NextResponse.json({ error: "type must be one of PDF, DOCX, PPTX." }, { status: 400 });
    }
    if (typeof title !== "string" || title.trim().length < 2) {
      return NextResponse.json({ error: "Enter a material title." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    }

    const validationError = validateLessonMaterialFile(type as "PDF" | "DOCX" | "PPTX", file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const url = await uploadLessonMaterial(file, params.id);

    // Same order-assignment transaction as the JSON-body route — kept
    // as its own copy rather than a shared helper, matching this
    // project's own established precedent of small upload routes each
    // copying a proven shape instead of a premature abstraction.
    const material = await prisma.$transaction(async (tx: any) => {
      const agg = await tx.material.aggregate({ where: { lessonId: params.id }, _max: { order: true } });
      return tx.material.create({
        data: {
          type: type as "PDF" | "DOCX" | "PPTX",
          title: title.trim(),
          url,
          lessonId: params.id,
          order: (agg._max.order ?? -1) + 1,
        },
      });
    });
    return NextResponse.json(material, { status: 201 });
  });
}
