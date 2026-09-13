import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { validateCurriculumFile, uploadCurriculum, deleteCurriculumBestEffort } from "@/lib/courseCurriculum";

/**
 * POST/DELETE /api/courses/[id]/curriculum — curriculum document
 * upload, same shape as the flyer route right beside it. This blob is
 * `access: "public"` like every upload in this app — deliberately
 * correct here, not just inherited, since the curriculum is meant to
 * be downloadable pre-enrollment (see buildMarketingView).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const course = await requireOwnedCourse(params.id, session.userId);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    const validationError = validateCurriculumFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const url = await uploadCurriculum(file, `course-${course.id}`);
    const updated = await prisma.course.update({
      where: { id: course.id },
      data: { curriculumUrl: url, curriculumUploadedAt: new Date() },
      select: { curriculumUrl: true, curriculumUploadedAt: true },
    });

    if (course.curriculumUrl) {
      await deleteCurriculumBestEffort(course.curriculumUrl);
    }

    return NextResponse.json(updated);
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const course = await requireOwnedCourse(params.id, session.userId);

    const updated = await prisma.course.update({
      where: { id: course.id },
      data: { curriculumUrl: null, curriculumUploadedAt: null },
      select: { curriculumUrl: true, curriculumUploadedAt: true },
    });

    if (course.curriculumUrl) {
      await deleteCurriculumBestEffort(course.curriculumUrl);
    }

    return NextResponse.json(updated);
  });
}
