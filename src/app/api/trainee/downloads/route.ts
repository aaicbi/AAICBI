import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/trainee/downloads — the real "My Downloads" list M40's own
 * scope calls for: trainee-chosen, per-material downloads, with the
 * trainee able to see and remove what they've downloaded. `isStale`
 * compares the snapshot taken at download time against the material's
 * current state — the same comparison the update route's own
 * notification logic is built around, so a trainee who missed or
 * deleted the email still has a clear, always-current way to see
 * what's out of date.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const downloads = await prisma.materialDownload.findMany({
      where: { traineeId: session.userId },
      orderBy: { downloadedAt: "desc" },
      include: {
        material: {
          select: {
            id: true,
            title: true,
            type: true,
            updatedAt: true,
            lesson: {
              select: {
                title: true,
                module: { select: { courseId: true, course: { select: { title: true } } } },
              },
            },
          },
        },
      },
    });

    const result = downloads.map((d: (typeof downloads)[number]) => ({
      materialId: d.materialId,
      title: d.material.title,
      type: d.material.type,
      lessonTitle: d.material.lesson.title,
      courseId: d.material.lesson.module.courseId,
      courseTitle: d.material.lesson.module.course.title,
      downloadedAt: d.downloadedAt,
      isStale: d.material.updatedAt.getTime() > d.materialUpdatedAt.getTime(),
    }));
    return NextResponse.json(result);
  });
}
