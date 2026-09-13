import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { validateFlyerFile, uploadFlyer, deleteFlyerBestEffort } from "@/lib/courseFlyer";

/**
 * POST/DELETE /api/courses/[id]/flyer — course flyer upload, same
 * upload-new-then-write-then-best-effort-delete-old ordering as
 * src/app/api/admin/avatar/route.ts. The flyer is optional by design
 * — an admin who never uploads one just gets a course page with no
 * flyer section (showFlyer/flyerUrl both stay their defaults).
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
    const validationError = validateFlyerFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const url = await uploadFlyer(file, `course-${course.id}`);
    const updated = await prisma.course.update({
      where: { id: course.id },
      data: { flyerUrl: url, flyerUploadedAt: new Date() },
      select: { flyerUrl: true, flyerUploadedAt: true },
    });

    if (course.flyerUrl) {
      await deleteFlyerBestEffort(course.flyerUrl);
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
      data: { flyerUrl: null, flyerUploadedAt: null },
      select: { flyerUrl: true, flyerUploadedAt: true },
    });

    if (course.flyerUrl) {
      await deleteFlyerBestEffort(course.flyerUrl);
    }

    return NextResponse.json(updated);
  });
}
