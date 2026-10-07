import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";

/** GET /api/org/programs — the organization's own courses with the skills each one teaches. */
export async function GET() {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    if (!org.staffUserId) return NextResponse.json([]);
    const courses = await prisma.course.findMany({
      where: { createdById: org.staffUserId },
      orderBy: { title: "asc" },
      select: { id: true, title: true, category: true, status: true, skills: { select: { skill: { select: { name: true } } } } },
    });
    return NextResponse.json(courses.map((c) => ({ id: c.id, title: c.title, category: c.category, status: c.status, skills: c.skills.map((s) => s.skill.name) })));
  });
}
