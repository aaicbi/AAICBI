/**
 * Text from an old-format Word file (.doc). The newer .docx is read by
 * mammoth (docxParser.ts); this older binary format needs its own reader.
 */
import WordExtractor from "word-extractor";
import { DocxParseError } from "@/lib/parsing/docxParser";

export async function extractTextFromDoc(buffer: Buffer): Promise<string> {
  let text: string;
  try {
    const doc = await new WordExtractor().extract(buffer);
    text = doc.getBody().replace(/\r/g, "").trim();
  } catch {
    throw new DocxParseError("Invalid file. Please upload a PDF or a Microsoft Word (.docx or .doc) document.");
  }
  if (!text) throw new DocxParseError("This document appears to be empty, or its content could not be read.");
  return text;
}
