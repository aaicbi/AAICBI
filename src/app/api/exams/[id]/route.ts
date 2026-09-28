import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedExam } from "@/lib/courseOwnership";
import { guardExamDeletable } from "@/lib/deletionGuards";
import { issueRetroactiveExamCertificates } from "@/lib/certificates";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    // Whole-project audit finding: SUPER_ADMIN can view any exam's full
    // detail (including its question bank), not just their own — same
    // "viewing broadens, editing/deleting doesn't" boundary as every
    // other SUPER_ADMIN carve-out in this pass. PUT/DELETE below still
    // call requireOwnedExam unconditionally, unchanged.
    if (session.role === "SUPER_ADMIN") {
      const exists = await prisma.exam.findUnique({ where: { id: params.id }, select: { id: true } });
      if (!exists) return NextResponse.json({ error: "Examination not found." }, { status: 404 });
    } else {
      await requireOwnedExam(params.id, session.userId); // M11 audit finding — see courseOwnership.ts
    }
    const exam = await prisma.exam.findUniqueOrThrow({
      where: { id: params.id },
      include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
    });
    return NextResponse.json(exam);
  });
}

// M11 audit finding, same pass as the ownership check above: this route
// previously spread `await req.json()` directly into `prisma.exam.update`
// with no schema at all — a mass-assignment gap letting any request
// body field through, including ones that should never be
// client-settable (id, code, moduleId, createdById, createdAt). Every
// other update route in this project (courses, modules, lessons,
// questions) already validates with zod; this one just hadn't been
// brought in line yet.
const UpdateExamSchema = z
  .object({
    title: z.string().min(3),
    description: z.string().nullable(),
    course: z.string().nullable(),
    module: z.string().nullable(),
    cohort: z.string().nullable(),
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
    monitoringEnabled: z.boolean(),
    // Standalone-exam certificates — only meaningful for an exam with
    // no courseId/moduleId (see ExamCertificate's own schema comment);
    // harmless no-op otherwise, since examEngine.ts only reads it on
    // that branch.
    certificateEnabled: z.boolean(),
  })
  .partial();

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const before = await requireOwnedExam(params.id, session.userId);

    const body = await req.json();
    const parsed = UpdateExamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const exam = await prisma.exam.update({ where: { id: params.id }, data: parsed.data });

    // Turning certificates on shouldn't silently exclude everyone who
    // already passed before the toggle existed — see
    // issueRetroactiveExamCertificates's own comment. Never blocks the
    // response; a slow or failed backfill is not a reason to fail the
    // settings save itself.
    if (parsed.data.certificateEnabled && !before.certificateEnabled) {
      issueRetroactiveExamCertificates(exam.id).catch((e) =>
        console.error(`Retroactive exam certificate issuance failed for exam ${exam.id}:`, e)
      );
    }

    return NextResponse.json(exam);
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedExam(params.id, session.userId);
    await guardExamDeletable(params.id); // M11 audit finding — see deletionGuards.ts
    await prisma.exam.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}
