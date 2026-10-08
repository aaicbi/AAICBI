import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedModule } from "@/lib/courseOwnership";
import { splitIntoQuestionBlocks, DocxParseError } from "@/lib/parsing/docxParser";
import { extractTextFromQuestionFile, questionFileKind, QUESTION_FILE_ERROR } from "@/lib/parsing/questionFile";
import { importQuestionsIntoExam } from "@/lib/questionImport";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);

/**
 * POST /api/modules/[id]/assessment/import
 *
 * The M11 version of POST /api/exams/[id]/import — same stages 1-9 of
 * §32 (validate → extract text → split into blocks → AI-structure →
 * save with needsReview flags), extended with one new stage: an
 * embedding-based duplicate check against the module's existing bank
 * before each question is saved.
 *
 * Auto-creates the module's assessment shell (with default settings —
 * see src/app/api/modules/[id]/assessment/route.ts for what those are)
 * on first upload if one doesn't exist yet, so an instructor can start
 * building a bank the moment a module exists, without a separate
 * "configure settings first" step.
 *
 * ---------------------------------------------------------------------
 * Audit fix (two bugs, same root cause): an earlier version of this
 * route ran the duplicate check ONE QUESTION AT A TIME inside the same
 * loop as the database writes — one Voyage API call per question
 * (despite embedTexts() being built to batch, and its own doc comment
 * claiming that benefit), one re-fetch-and-reparse of the whole bank
 * per question, and no transaction wrapping the writes (a long-held
 * transaction across that many slow, sequential network calls would
 * have been its own anti-pattern on serverless Postgres). The
 * consequence: a 60-question import made ~60 sequential Voyage
 * round-trips on top of the AI-structuring loop's already-sequential
 * Claude calls — roughly doubling the risk of hitting a serverless
 * timeout on a larger document — AND a failure partway through left
 * whatever had already been created sitting in the database, with no
 * clean rollback and no signal to the admin about how much got
 * through, risking silent duplication on a naive retry.
 *
 * Fixed by splitting this route into two clean phases:
 *   1. Everything slow and network-bound (AI structuring, ONE batched
 *      Voyage call, ONE bank fetch, all duplicate comparison) happens
 *      first, entirely before any database write.
 *   2. Everything left — creating each Question/Option row and saving
 *      its embedding — is now pure, fast database work, wrapped in one
 *      `prisma.$transaction(...)`, so a failure partway through rolls
 *      the whole import back instead of leaving a partial bank.
 * ---------------------------------------------------------------------
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const mod = await requireOwnedModule(params.id, session.userId, session.role);

    let exam = await prisma.exam.findUnique({ where: { moduleId: params.id } });
    if (!exam) {
      const title = `${mod.title} — Assessment`;
      try {
        exam = await prisma.exam.create({
          data: {
            title,
            code: makeExamCode(title),
            moduleId: params.id,
            createdById: session.userId,
          },
        });
      } catch (e) {
        // M11 audit finding: two near-simultaneous first-uploads for
        // the same module (an instructor double-clicking on a slow
        // connection, or two staff sessions) can both pass the
        // `!exam` check above and both try to create the shell —
        // moduleId's @unique constraint means the loser hits Prisma's
        // P2002 here. Rather than surface that raw, just use whichever
        // shell actually won; the goal of this block was never "this
        // exact request must be the one to create it," only "an
        // assessment exists for this module before the import runs."
        const code = (e as { code?: string }).code;
        if (code !== "P2002") throw e;
        exam = await prisma.exam.findUnique({ where: { moduleId: params.id } });
        if (!exam) throw e; // genuinely unexpected — surface the original error
      }
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }
    const kind = questionFileKind(file.name);
    if (!kind) {
      return NextResponse.json({ error: QUESTION_FILE_ERROR }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File is too large. Maximum size is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let text: string;
    try {
      text = await extractTextFromQuestionFile(kind, buffer);
    } catch (e) {
      if (e instanceof DocxParseError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    let blocks;
    try {
      blocks = splitIntoQuestionBlocks(text);
    } catch (e) {
      if (e instanceof DocxParseError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    // The slow AI and duplicate-check work, then one all-or-nothing save: see questionImport.ts.
    return NextResponse.json(await importQuestionsIntoExam(exam.id, blocks));
  });
}

function makeExamCode(title: string): string {
  const slug = title
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug}-${suffix}`;
}
