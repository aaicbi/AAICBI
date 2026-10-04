import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { assignmentCreatedByFilter } from "@/lib/assignmentOwnership";

/**
 * GET /api/admin/assignments — the review-queue/list page's own data
 * source. Same createdByFilter scoping discipline as every other
 * staff-authored content list in this app (SUPER_ADMIN sees
 * everything, ADMIN/INSTRUCTOR see only their own).
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const assignments = await prisma.assignment.findMany({
      where: assignmentCreatedByFilter(session),
      orderBy: { createdAt: "desc" },
      include: {
        module: { select: { id: true, title: true } },
        course: { select: { id: true, title: true } },
        _count: { select: { questions: true, submissions: true } },
      },
    });
    return NextResponse.json(assignments);
  });
}

const CreateSchema = z.object({
  title: z.string().min(3),
  description: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  moduleId: z.string().nullable().optional(),
  courseId: z.string().nullable().optional(),
});

/**
 * POST /api/admin/assignments — manual creation (no document upload),
 * for an instructor who wants to build an assignment's questions
 * directly rather than importing a Word document. Starts empty — the
 * question-CRUD routes add questions afterward, same "create the shell,
 * fill it in" shape as course creation.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const assignment = await prisma.assignment.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        instructions: parsed.data.instructions,
        moduleId: parsed.data.moduleId || null,
        courseId: parsed.data.courseId || null,
        createdById: session.userId,
        status: "DRAFT",
      },
    });
    return NextResponse.json(assignment, { status: 201 });
  });
}
