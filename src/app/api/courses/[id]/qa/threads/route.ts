import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";

/**
 * GET /api/courses/[id]/qa/threads — the staff-facing counterpart to
 * the per-lesson trainee list, spanning every lesson in the course at
 * once. Staff moderating Q&A needs to find a thread worth reviewing
 * without knowing which specific lesson it's under first.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, session.userId);

    const threads = await prisma.qaThread.findMany({
      where: { lesson: { module: { courseId: params.id } } },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        lesson: { select: { id: true, title: true } },
        _count: { select: { posts: true } },
      },
      take: 100,
    });
    return NextResponse.json(threads);
  });
}
