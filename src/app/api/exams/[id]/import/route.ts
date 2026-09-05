import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { extractTextFromDocx, splitIntoQuestionBlocks, DocxParseError } from "@/lib/parsing/docxParser";
import { extractQuestionsBatch } from "@/lib/ai/extractQuestions";
import { requireOwnedExam } from "@/lib/courseOwnership";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);

/**
 * Runs stages 1-9 of §32 in one request: validate → extract text → split
 * into blocks → AI-structure → save to DB with needsReview flags →
 * return the import summary the review screen (§11) renders.
 *
 * Deliberately synchronous/blocking rather than a background job — fine
 * for the tens-of-questions documents this is built for. If your
 * documents regularly run past ~150 questions, move the AI-structuring
 * loop into a queue (e.g. a simple DB-backed job table) so this route
 * doesn't hit a serverless timeout.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const exam = await requireOwnedExam(params.id, session.userId); // M11 audit finding — see courseOwnership.ts

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json(
        { error: "Invalid file. Please upload a Microsoft Word (.docx) document." },
        { status: 400 }
      );
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
      text = await extractTextFromDocx(buffer);
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

    const extracted = await extractQuestionsBatch(blocks);

    // Persist every question — including the ones needing review — at
    // `order` continuing from whatever's already in this exam. Never
    // auto-publish (§32 stage 12 is a separate, explicit admin action).
    const existingCount = await prisma.question.count({ where: { examId: exam.id } });

    const created = await prisma.$transaction(
      extracted.map((item, idx) =>
        prisma.question.create({
          data: {
            examId: exam.id,
            text: item.structured.question,
            topic: item.structured.topic,
            difficulty: (item.structured.difficulty?.toUpperCase() as
              | "BEGINNER"
              | "INTERMEDIATE"
              | "ADVANCED"
              | undefined) ?? "BEGINNER",
            explanation: item.structured.explanation,
            order: existingCount + idx,
            needsReview: item.needsReview,
            reviewReason: item.reviewReason,
            options: {
              create: item.structured.options.map((text, optIdx) => ({
                text,
                key: String.fromCharCode(65 + optIdx), // A, B, C...
                isCorrect: optIdx === item.structured.correct_option_index,
                order: optIdx,
              })),
            },
          },
          include: { options: true },
        })
      )
    );

    const validCount = created.filter((q) => !q.needsReview).length;

    return NextResponse.json({
      questionsDetected: created.length,
      validQuestions: validCount,
      questionsRequiringReview: created.length - validCount,
      questions: created,
    });
  });
}
