import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitIntoQuestionBlocks } from "@/lib/parsing/docxParser";
import { extractTextFromQuestionFile, questionFileKind } from "@/lib/parsing/questionFile";

describe("question files", () => {
  it("recognises Word and PDF by extension", () => {
    expect(questionFileKind("Exam.PDF")).toBe("pdf");
    expect(questionFileKind("exam.docx")).toBe("docx");
    expect(questionFileKind("exam.doc")).toBe("doc");
    expect(questionFileKind("exam.txt")).toBeNull();
    expect(questionFileKind("exam.pdf.exe")).toBeNull();
  });

  it("reads the questions out of a text PDF", async () => {
    const text = await extractTextFromQuestionFile("pdf", readFileSync(join(__dirname, "fixtures/questions.pdf")));
    const blocks = splitIntoQuestionBlocks(text);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].questionText).toMatch(/CPU stand for/);
    expect(blocks[0].options.map((o) => o.label)).toEqual(["A", "B", "C", "D"]);
    expect(blocks[1].answerLabel).toBe("B");
  });

  it("reads the questions out of an old-format .doc", async () => {
    const text = await extractTextFromQuestionFile("doc", readFileSync(join(__dirname, "fixtures/q.doc")));
    const blocks = splitIntoQuestionBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[1].answerLabel).toBe("B");
    await expect(extractTextFromQuestionFile("doc", Buffer.from("nope"))).rejects.toThrow(/Word/);
  });

  it("refuses a file that is not really a PDF, and a PDF with no text", async () => {
    await expect(extractTextFromQuestionFile("pdf", Buffer.from("not a pdf"))).rejects.toThrow(/PDF or a Microsoft Word/);
    const blank = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
    await expect(extractTextFromQuestionFile("pdf", blank)).rejects.toThrow();
  });
});
