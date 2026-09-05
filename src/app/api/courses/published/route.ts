import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/courses/published — every published course, for a logged-in
 * trainee to browse. Deliberately not filtered by enrollment — M10
 * scope is "any trainee can view any published course," see the schema
 * comment on the Course/Module/Lesson/Material block for why real
 * enrollment logic is out of scope until later.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    await requireRole("TRAINEE");
    const courses = await prisma.course.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { modules: true } } },
    });
    return NextResponse.json(courses);
  });
}
