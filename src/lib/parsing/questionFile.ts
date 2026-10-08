import { DocxParseError, extractTextFromDocx } from "@/lib/parsing/docxParser";
import { extractTextFromPdf } from "@/lib/parsing/pdfParser";
import { extractTextFromDoc } from "@/lib/parsing/docParser";

export const QUESTION_FILE_ERROR = "Invalid file. Please upload a PDF or a Microsoft Word (.docx or .doc) document.";

export type QuestionFileKind = "docx" | "doc" | "pdf";

export function questionFileKind(fileName: string): QuestionFileKind | null {
  const n = fileName.toLowerCase();
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".doc")) return "doc";
  if (n.endsWith(".pdf")) return "pdf";
  return null;
}

/** Text from an uploaded questions file, Word or PDF. Throws DocxParseError with a message safe to show. */
export async function extractTextFromQuestionFile(kind: QuestionFileKind, buffer: Buffer): Promise<string> {
  if (kind === "pdf") {
    // A real PDF starts with %PDF; checking first gives a clearer error than a parser failure.
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw new DocxParseError(QUESTION_FILE_ERROR);
    return extractTextFromPdf(buffer);
  }
  if (kind === "doc") return extractTextFromDoc(buffer);
  return extractTextFromDocx(buffer);
}
