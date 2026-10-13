/**
 * One reader for every document type the platform deals with, so Loop (and any
 * other AI feature) can read lesson notes, slide decks, spreadsheets and plain
 * files the same way no matter where they came from — a module material or a
 * file attached to a chat.
 *
 * Detects the type from the file's own bytes (not its name, which can lie):
 *   PDF · Word (.docx, old .doc) · PowerPoint (.pptx, slides and speaker notes)
 *   Excel (.xlsx) · text, Markdown, CSV, JSON, HTML.
 * Scanned PDFs and pictures have no text to extract; those are refused with a
 * plain reason (a picture can be shown to Claude directly instead).
 */
import JSZip from "jszip";
import { extractTextFromDocx, DocxParseError } from "@/lib/parsing/docxParser";
import { extractTextFromDoc } from "@/lib/parsing/docParser";
import { extractTextFromPdf } from "@/lib/parsing/pdfParser";

export type DocumentKind = "pdf" | "docx" | "doc" | "pptx" | "xlsx" | "text" | "image" | "unknown";

export const MAX_DOCUMENT_CHARS = 60_000;

export interface ExtractedDocument {
  kind: DocumentKind;
  text: string;
  /** True when the text was cut at MAX_DOCUMENT_CHARS. */
  truncated: boolean;
}

function startsWith(buf: Buffer, bytes: number[]): boolean {
  return bytes.every((b, i) => buf[i] === b);
}

/** Looks inside a zip-based Office file to tell Word, PowerPoint and Excel apart. */
async function officeKind(buffer: Buffer): Promise<DocumentKind> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    if (zip.file("word/document.xml")) return "docx";
    if (Object.keys(zip.files).some((n) => n.startsWith("ppt/slides/slide"))) return "pptx";
    if (zip.file("xl/workbook.xml")) return "xlsx";
  } catch {
    // not a zip after all
  }
  return "unknown";
}

export async function detectDocumentKind(buffer: Buffer, filename = "", mime = ""): Promise<DocumentKind> {
  if (buffer.length >= 4 && startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (buffer.length >= 4 && startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) return officeKind(buffer); // PK
  if (buffer.length >= 8 && startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0])) return "doc";
  if (buffer.length >= 8 && (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47]) || startsWith(buffer, [0xff, 0xd8, 0xff]))) return "image";
  if (buffer.length >= 12 && buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP") return "image";
  if (/^image\//.test(mime)) return "image";
  const looksText = !buffer.subarray(0, 4096).includes(0);
  if (looksText && (/\.(txt|md|csv|json|html?|xml|tsv|log)$/i.test(filename) || /^text\//.test(mime) || /json|xml/.test(mime))) return "text";
  return looksText && buffer.length > 0 ? "text" : "unknown";
}

const decodeEntities = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");

/** Text runs (<a:t>) of one DrawingML part, one paragraph (<a:p>) per line. */
function drawingText(xml: string): string {
  const paragraphs = xml.split(/<\/a:p>/);
  const lines: string[] = [];
  for (const p of paragraphs) {
    const runs = [...p.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((m) => decodeEntities(m[1]));
    const line = runs.join("").trim();
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

const numberInName = (name: string) => Number(name.match(/(\d+)\.xml$/)?.[1] ?? 0);

export async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new DocxParseError("This PowerPoint file could not be opened.");
  }
  const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => numberInName(a) - numberInName(b));
  const parts: string[] = [];
  for (const name of slides) {
    const n = numberInName(name);
    const body = drawingText(await zip.files[name].async("string"));
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${n}.xml`);
    const notes = notesFile ? drawingText(await notesFile.async("string")) : "";
    const section = [`Slide ${n}`, body, notes ? `Speaker notes: ${notes}` : ""].filter(Boolean).join("\n");
    if (body || notes) parts.push(section);
  }
  const text = parts.join("\n\n").trim();
  if (!text) throw new DocxParseError("This presentation has no readable text (it may be only pictures).");
  return text;
}

export async function extractTextFromXlsx(buffer: Buffer): Promise<string> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new DocxParseError("This Excel file could not be opened.");
  }
  const sharedFile = zip.file("xl/sharedStrings.xml");
  const shared: string[] = [];
  if (sharedFile) {
    const xml = await sharedFile.async("string");
    for (const si of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push(decodeEntities([...si[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join("")));
    }
  }
  const workbook = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
  const sheetNames = [...workbook.matchAll(/<sheet\s[^>]*name="([^"]*)"/g)].map((m) => decodeEntities(m[1]));
  const sheets = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => numberInName(a) - numberInName(b));
  const parts: string[] = [];
  for (const [i, name] of sheets.entries()) {
    const xml = await zip.files[name].async("string");
    const rows: string[] = [];
    for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const inner = c[2] ?? "";
        const value = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        const inline = inner.match(/<is>[\s\S]*?<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/)?.[1];
        if (/t="s"/.test(attrs) && value !== undefined) cells.push(shared[Number(value)] ?? "");
        else if (inline !== undefined) cells.push(decodeEntities(inline));
        else if (value !== undefined) cells.push(decodeEntities(value));
        else cells.push("");
      }
      if (cells.some((c) => c !== "")) rows.push(cells.join("\t").replace(/\t+$/, ""));
    }
    if (rows.length) parts.push(`Sheet: ${sheetNames[i] ?? `Sheet ${i + 1}`}\n${rows.join("\n")}`);
  }
  const text = parts.join("\n\n").trim();
  if (!text) throw new DocxParseError("This spreadsheet has no readable cells.");
  return text;
}

function clip(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_DOCUMENT_CHARS) return { text, truncated: false };
  return { text: `${text.slice(0, MAX_DOCUMENT_CHARS)}\n\n[… cut here: the document is longer than ${MAX_DOCUMENT_CHARS.toLocaleString()} characters]`, truncated: true };
}

export async function extractDocumentText(buffer: Buffer, hints: { filename?: string; mime?: string } = {}): Promise<ExtractedDocument> {
  const kind = await detectDocumentKind(buffer, hints.filename, hints.mime);
  let raw: string;
  switch (kind) {
    case "pdf":
      raw = await extractTextFromPdf(buffer);
      break;
    case "docx":
      raw = await extractTextFromDocx(buffer);
      break;
    case "doc":
      raw = await extractTextFromDoc(buffer);
      break;
    case "pptx":
      raw = await extractTextFromPptx(buffer);
      break;
    case "xlsx":
      raw = await extractTextFromXlsx(buffer);
      break;
    case "text":
      raw = buffer.toString("utf8").replace(/\r/g, "").trim();
      if (!raw) throw new DocxParseError("This file is empty.");
      break;
    case "image":
      throw new DocxParseError("This is a picture, so there is no text to extract.");
    default:
      throw new DocxParseError("This file type isn't supported. Use PDF, Word, PowerPoint, Excel or a plain text file.");
  }
  const { text, truncated } = clip(raw);
  return { kind, text, truncated };
}
