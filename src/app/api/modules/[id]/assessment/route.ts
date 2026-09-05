import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedModule } from "@/lib/courseOwnership";
import { getModuleLockStatus } from "@/lib/progress";
import { hasCourseAccess } from "@/lib/courseAccess";

// Same code-generation helper as POST /api/exams, duplicated locally on
// purpose rather than imported — it's five lines with zero dependencies
// of its own, and importing across route files for something this
// small isn't worth the coupling. A module-scoped assessment still gets
// a code (see the schema comment on Exam.code) even though a trainee
// never types it.
function makeExamCode(title: string): string {
  const slug = title
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug}-${suffix}`;
}

const CreateAssessmentSchema = z.object({
  title: z.string().min(3).optional(), // defaults to "<Module title> — Assessment" if omitted
  instructions: z.string().nullable().optional(),
  durationMinutes: z.number().int().positive().default(60),
  passMarkPercent: z.number().int().min(0).max(100).default(80),
  numQuestions: z.number().int().positive().nullable().optional(),
  maxAttempts: z.number().int().positive().nullable().optional(),
  randomizeQuestions: z.boolean().default(true),
  randomizeOptions: z.boolean().default(true),
  showResultImmediately: z.boolean().default(true),
  showCorrectAnswers: z.boolean().default(false),
  allowReview: z.boolean().default(true),
});

// Deliberately a separate schema from CreateAssessmentSchema, not
// `.partial()` of it — that schema's fields carry zod `.default()`
// values, and `.partial()` doesn't strip those; an update request that
// only sends `{ passMarkPercent: 90 }` would otherwise silently reset
// durationMinutes back to 60 and every boolean flag back to its
// default. This schema has no defaults, so an omitted field is left
// alone by the `prisma.exam.update` below rather than overwritten.
const UpdateAssessmentSchema = z
  .object({
    title: z.string().min(3),
    instructions: z.string().nullable(),
    durationMinutes: z.number().int().positive(),
    passMarkPercent: z.number().int().min(0).max(100),
    numQuestions: z.number().int().positive().nullable(),
    maxAttempts: z.number().int().positive().nullable(),
    randomizeQuestions: z.boolean(),
    randomizeOptions: z.boolean(),
    showResultImmediately: z.boolean(),
    showCorrectAnswers: z.boolean(),
    allowReview: z.boolean(),
  })
  .partial();

/**
 * GET /api/modules/[id]/assessment
 *
 * Shared, role-shaped route — same pattern as GET /api/courses/[id]:
 * one endpoint, two different visibility rules baked in, rather than
 * splitting into a staff route and a trainee route that could drift
 * apart over time.
 *
 *  - Staff (must own the module's course): the full exam record,
 *    including every question, its options, and which one is
 *    correct — the "build/review the bank" view, the same shape
 *    GET /api/exams/[id] already returns for a non-module exam.
 *  - Trainee: only if the assessment is published, and only fields
 *    safe to show before an attempt exists — no questions, no
 *    answers. A trainee gets the exact same 404 whether the module
 *    has no assessment yet or has one that isn't published yet —
 *    never confirm an unpublished assessment's existence, matching
 *    the course GET route's own reasoning.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session) {
      const err = new Error("Not authenticated") as Error & { status?: number };
      err.status = 401;
      throw err;
    }

    const isStaff = session.role === "SUPER_ADMIN" || session.role === "ADMIN" || session.role === "INSTRUCTOR";

    if (isStaff) {
      const mod = await requireOwnedModule(params.id, session.userId);
      const exam = await prisma.exam.findUnique({
        where: { moduleId: params.id },
        include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
      });
      if (!exam) {
        // Still tell the admin page the module's title/courseId even
        // when there's no assessment yet — it needs that for the page
        // header and "back to course" link before an exam row exists.
        return NextResponse.json(
          { error: "This module doesn't have an assessment yet.", moduleTitle: mod.title, courseId: mod.courseId },
          { status: 404 }
        );
      }
      return NextResponse.json({ ...exam, moduleTitle: mod.title, courseId: mod.courseId });
    }

    // Trainee path.
    const exam = await prisma.exam.findUnique({
      where: { moduleId: params.id },
      select: {
        id: true,
        title: true,
        instructions: true,
        durationMinutes: true,
        passMarkPercent: true,
        maxAttempts: true,
        numQuestions: true,
        published: true,
        courseModule: { select: { courseId: true } },
        _count: { select: { questions: true } },
      },
    });
    if (!exam || !exam.published || !exam.courseModule) {
      return NextResponse.json({ error: "This module doesn't have an assessment available yet." }, { status: 404 });
    }

    // M18 — a real gap this closed, same pattern as the M12 finding
    // right below it: module-lock status was already enforced, but
    // nothing checked whether the trainee was ever enrolled in the
    // course at all. Same 404-not-403 reasoning as the lock check
    // below — don't let "not enrolled" be distinguishable from
    // "doesn't exist" for something a trainee was never meant to see.
    const enrolled = await hasCourseAccess(session.userId, exam.courseModule.courseId);
    if (!enrolled) {
      return NextResponse.json({ error: "This module doesn't have an assessment available yet." }, { status: 404 });
    }

    // M12 audit finding: this route previously returned assessment
    // metadata (title, duration, pass mark, question count) for ANY
    // published assessment, with no check on whether the trainee had
    // actually unlocked the module it belongs to — only the
    // start-attempt route enforced that. The normal UI never exposed
    // this (the "Take Assessment" button only renders for an unlocked
    // module), but nothing stopped a direct request here. Same 404 as
    // "no assessment yet" — don't let a locked module's assessment be
    // distinguishable from a nonexistent one, matching how the rest of
    // this project treats "not allowed to see" and "doesn't exist" as
    // the same response.
    const lockStatus = await getModuleLockStatus(exam.courseModule.courseId, params.id, session.userId);
    if (!lockStatus?.unlocked) {
      return NextResponse.json({ error: "This module doesn't have an assessment available yet." }, { status: 404 });
    }

    return NextResponse.json({
      id: exam.id,
      title: exam.title,
      instructions: exam.instructions,
      durationMinutes: exam.durationMinutes,
      passMarkPercent: exam.passMarkPercent,
      maxAttempts: exam.maxAttempts,
      totalQuestions: exam.numQuestions ?? exam._count.questions,
    });
  });
}

/** POST /api/modules/[id]/assessment — create the module's (at most
 * one) assessment shell with settings. Most instructors will actually
 * reach this indirectly via the import route below, which auto-creates
 * a shell with sensible defaults on first upload — this route exists
 * for configuring settings up front, or for an instructor who wants to
 * hand-author every question via POST /api/exams/[id]/questions
 * instead of uploading a DOCX. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const mod = await requireOwnedModule(params.id, session.userId);

    const existing = await prisma.exam.findUnique({ where: { moduleId: params.id } });
    if (existing) {
      return NextResponse.json(
        { error: "This module already has an assessment. Use PUT to update its settings." },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = CreateAssessmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const title = parsed.data.title ?? `${mod.title} — Assessment`;
    try {
      const exam = await prisma.exam.create({
        data: {
          ...parsed.data,
          title,
          code: makeExamCode(title),
          moduleId: params.id,
          createdById: session.userId,
        },
      });
      return NextResponse.json(exam, { status: 201 });
    } catch (e) {
      // M11 audit finding: the `existing` check above has a race
      // window — two near-simultaneous POSTs can both read `null` and
      // both attempt to create, and the loser hits moduleId's
      // @unique constraint (P2002) here instead of the friendly 409
      // above. Unlike the import route's version of this same race,
      // a genuine double-create attempt through this specific
      // endpoint SHOULD still be a 409 (the person's intent was "set
      // up a new assessment," not "ensure one exists") — just the
      // same friendly message the normal path already gives, not a
      // raw database error.
      const code = (e as { code?: string }).code;
      if (code === "P2002") {
        return NextResponse.json(
          { error: "This module already has an assessment. Use PUT to update its settings." },
          { status: 409 }
        );
      }
      throw e;
    }
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedModule(params.id, session.userId);

    const existing = await prisma.exam.findUnique({ where: { moduleId: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "This module doesn't have an assessment yet." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = UpdateAssessmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const exam = await prisma.exam.update({ where: { moduleId: params.id }, data: parsed.data });
    return NextResponse.json(exam);
  });
}
