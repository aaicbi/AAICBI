/**
 * Plain-text extraction for a PDF of exam questions, so it can go through
 * the same split → AI-structure → review pipeline as a Word document.
 * Only text PDFs work: a scanned page is a picture with no text in it, and
 * is refused with a clear message instead of importing nothing.
 */
import { extractText, getDocumentProxy } from "unpdf";
import { DocxParseError } from "@/lib/parsing/docxParser";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  let text: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    text = (Array.isArray(result.text) ? result.text.join("\n") : result.text).replace(/\r/g, "").trim();
  } catch {
    throw new DocxParseError("Invalid file. Please upload a PDF or a Microsoft Word (.docx or .doc) document.");
  }
  if (!text) {
    throw new DocxParseError(
      "This PDF has no readable text. If it is a scan or photo of a printed page, export it from the original document or upload a Word (.docx) file instead.",
    );
  }
  return text;
}
