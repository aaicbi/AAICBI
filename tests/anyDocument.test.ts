import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { detectDocumentKind, extractDocumentText, MAX_DOCUMENT_CHARS } from "@/lib/parsing/anyDocument";

async function zipOf(files: Record<string, string>): Promise<Buffer> {
  const z = new JSZip();
  for (const [name, body] of Object.entries(files)) z.file(name, body);
  return Buffer.from(await z.generateAsync({ type: "nodebuffer" }));
}

const slide = (...paras: string[]) =>
  `<p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree>${paras
    .map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`)
    .join("")}</p:spTree></p:cSld></p:sld>`;

describe("detectDocumentKind", () => {
  it("recognises a PDF by its first bytes, whatever the name says", async () => {
    expect(await detectDocumentKind(Buffer.from("%PDF-1.7 ..."), "notes.docx")).toBe("pdf");
  });
  it("tells Word, PowerPoint and Excel zips apart", async () => {
    expect(await detectDocumentKind(await zipOf({ "word/document.xml": "<w/>" }))).toBe("docx");
    expect(await detectDocumentKind(await zipOf({ "ppt/slides/slide1.xml": slide("x") }))).toBe("pptx");
    expect(await detectDocumentKind(await zipOf({ "xl/workbook.xml": "<workbook/>" }))).toBe("xlsx");
  });
  it("recognises pictures and plain text", async () => {
    expect(await detectDocumentKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("image");
    expect(await detectDocumentKind(Buffer.from("hello"), "a.txt")).toBe("text");
  });
});

describe("extractDocumentText", () => {
  it("reads slides in order with speaker notes", async () => {
    const buf = await zipOf({
      "ppt/slides/slide2.xml": slide("Second slide", "Point &amp; more"),
      "ppt/slides/slide1.xml": slide("Title slide"),
      "ppt/notesSlides/notesSlide1.xml": slide("Say hello"),
    });
    const r = await extractDocumentText(buf);
    expect(r.kind).toBe("pptx");
    expect(r.text.indexOf("Slide 1")).toBeLessThan(r.text.indexOf("Slide 2"));
    expect(r.text).toContain("Title slide");
    expect(r.text).toContain("Speaker notes: Say hello");
    expect(r.text).toContain("Point & more");
  });

  it("reads spreadsheet cells, shared strings and sheet names", async () => {
    const buf = await zipOf({
      "xl/workbook.xml": `<workbook><sheets><sheet name="Scores" sheetId="1"/></sheets></workbook>`,
      "xl/sharedStrings.xml": `<sst><si><t>Name</t></si><si><t>Ada</t></si></sst>`,
      "xl/worksheets/sheet1.xml": `<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row><c r="A2"><v>42</v></c></row></sheetData></worksheet>`,
    });
    const r = await extractDocumentText(buf);
    expect(r.kind).toBe("xlsx");
    expect(r.text).toContain("Sheet: Scores");
    expect(r.text).toContain("Name\tAda");
    expect(r.text).toContain("42");
  });

  it("reads plain text and cuts very long documents", async () => {
    const r = await extractDocumentText(Buffer.from("a".repeat(MAX_DOCUMENT_CHARS + 500)), { filename: "big.txt" });
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBeLessThan(MAX_DOCUMENT_CHARS + 200);
  });

  it("refuses a picture and an empty presentation with a plain reason", async () => {
    await expect(extractDocumentText(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0]))).rejects.toThrow(/picture/);
    await expect(extractDocumentText(await zipOf({ "ppt/slides/slide1.xml": slide() }))).rejects.toThrow(/no readable text/);
  });
});
