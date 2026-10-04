import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { extractTextFromDocx, DocxParseError } from "@/lib/parsing/docxParser";
import { splitIntoAssignmentBlocks, AssignmentDocxParseError } from "@/lib/parsing/assignmentDocxParser";
import { extractAssignmentQuestionsBatch } from "@/lib/ai/extractAssignmentQuestions";
import { validateAssignmentDocFile, uploadAssignmentDoc } from "@/lib/assignmentDocUpload";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);

/**
 * POST /api/admin/assignments/import — mirrors
 * /api/exams/[id]/import's own pipeline shape exactly (validate →
 * extract text → split into blocks → AI-structure → save with
 * needsReview flags → return the import summary), but creates a BRAND
 * NEW, unattached DRAFT Assignment rather than adding questions to an
 * existing exam — an assignment doesn't exist yet to import into.
 * Never auto-published — see the publish route for that explicit,
 * separate, validation-gated action.
 *
 * Deliberately synchronous/blocking, same accepted trade-off as the
 * exam importer's own comment: fine for the tens-of-questions documents
 * this is built for.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }
    const fileError = validateAssignmentDocFile(file);
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `File is too large. Maximum size is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let text: string;
    try {
      text = await extractTextFromDocx(buffer);
    } catch (e) {
      if (e instanceof DocxParseError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }

    let parsedDoc;
    try {
      parsedDoc = splitIntoAssignmentBlocks(text);
    } catch (e) {
      if (e instanceof AssignmentDocxParseError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }

    const extracted = await extractAssignmentQuestionsBatch(parsedDoc.blocks);

    let sourceDocUrl: string | null = null;
    try {
      sourceDocUrl = await uploadAssignmentDoc(file, session.userId);
    } catch (e) {
      // Never fail the whole import over the audit-copy upload — the
      // real deliverable (the structured questions) is already in hand.
      console.error("Failed to upload the original assignment document for audit/re-import:", e);
    }

    // Same explicit-timeout interactive-transaction fix the exam
    // importer's own comment documents — the default 5s batch timeout
    // is too tight once a document has enough questions.
    const assignment = await prisma.$transaction(
      async (tx) => {
        const created = await tx.assignment.create({
          data: {
            title: parsedDoc.title ?? file.name.replace(/\.docx$/i, ""),
            instructions: parsedDoc.instructions,
            createdById: session.userId,
            status: "DRAFT",
            sourceDocUrl,
            sourceDocUploadedAt: sourceDocUrl ? new Date() : null,
          },
        });

        for (let idx = 0; idx < extracted.length; idx++) {
          const item = extracted[idx].structured;
          await tx.assignmentQuestion.create({
            data: {
              assignmentId: created.id,
              questionNumber: parsedDoc.blocks[idx].questionNumber ?? String(idx + 1),
              type: item.type,
              questionText: item.question,
              instructions: item.instructions,
              expectedAnswer: item.expectedAnswer,
              expectedConcepts: item.expectedConcepts ?? undefined,
              keywords: item.keywords ?? undefined,
              learningObjective: item.learningObjective,
              difficulty: item.difficulty,
              maxMarks: item.marks ?? 0,
              rubric: item.rubric ?? undefined,
              order: idx,
              needsReview: extracted[idx].needsReview,
              reviewReason: extracted[idx].reviewReason,
            },
          });
        }

        return tx.assignment.findUniqueOrThrow({ where: { id: created.id }, include: { questions: { orderBy: { order: "asc" } } } });
      },
      { timeout: 100_000, maxWait: 10_000 }
    );

    const validCount = assignment.questions.filter((q) => !q.needsReview).length;

    return NextResponse.json({
      assignment,
      questionsDetected: assignment.questions.length,
      validQuestions: validCount,
      questionsRequiringReview: assignment.questions.length - validCount,
    });
  });
}
