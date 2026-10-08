import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { ensureCourseExamination } from "@/lib/ai/generateCourseExam";
import { splitIntoQuestionBlocks, DocxParseError } from "@/lib/parsing/docxParser";
import { extractTextFromQuestionFile, questionFileKind, QUESTION_FILE_ERROR } from "@/lib/parsing/questionFile";
import { importQuestionsIntoExam } from "@/lib/questionImport";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);

/**
 * POST /api/courses/[id]/examination/import — add questions to the course
 * examination from a PDF or Word document, the same way a module
 * assessment is built. Creates the examination (unpublished) if it does not
 * exist yet, so importing is a complete alternative to "Generate Course
 * Examination". Questions the AI is unsure about, and possible duplicates,
 * are flagged for review; nothing is published here.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, session.userId, session.role);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    const kind = questionFileKind(file.name);
    if (!kind) return NextResponse.json({ error: QUESTION_FILE_ERROR }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `File is too large. Maximum size is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.` }, { status: 400 });
    }

    let blocks;
    try {
      const text = await extractTextFromQuestionFile(kind, Buffer.from(await file.arrayBuffer()));
      blocks = splitIntoQuestionBlocks(text);
    } catch (e) {
      if (e instanceof DocxParseError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }

    const exam = await ensureCourseExamination(params.id, session.userId);
    return NextResponse.json(await importQuestionsIntoExam(exam.id, blocks));
  });
}
