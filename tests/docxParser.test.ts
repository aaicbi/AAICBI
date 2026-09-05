import { describe, it, expect } from "vitest";
import { splitIntoQuestionBlocks, DocxParseError } from "@/lib/parsing/docxParser";

describe("splitIntoQuestionBlocks", () => {
  it("parses the 'A.' + 'Answer:' format", () => {
    const text = `
Question 1: What is data analysis?

A. The process of examining data to discover useful information
B. Writing computer games
C. Designing websites
D. Installing computers

Answer: A
`;
    const blocks = splitIntoQuestionBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].questionText).toContain("What is data analysis?");
    expect(blocks[0].options).toHaveLength(4);
    expect(blocks[0].answerLabel).toBe("A");
  });

  it("parses the lowercase 'a)' + 'Correct Answer:' format", () => {
    const text = `
1. What is Excel?

a) A spreadsheet application
b) A database server
c) A web browser
d) An operating system

Correct Answer: a
`;
    const blocks = splitIntoQuestionBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].options[0]).toEqual({ label: "A", text: "A spreadsheet application" });
    expect(blocks[0].answerLabel).toBe("A");
  });

  it("splits multiple questions in one document", () => {
    const text = `
1. What is Excel?
A. A spreadsheet application
B. A database server
Answer: A

2. What is a formula?
A. A calculation
B. A picture
Answer: A
`;
    const blocks = splitIntoQuestionBlocks(text);
    expect(blocks).toHaveLength(2);
  });

  it("does not invent an answer when none is present", () => {
    const text = `
1. What is Excel?
A. A spreadsheet application
B. A database server
`;
    const blocks = splitIntoQuestionBlocks(text);
    expect(blocks[0].answerLabel).toBeNull();
  });

  it("throws DocxParseError when no questions are found", () => {
    expect(() => splitIntoQuestionBlocks("Just some unrelated paragraph text.")).toThrow(DocxParseError);
  });
});
