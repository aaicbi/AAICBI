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

  // Bug fix regression — a real import produced 30 questions each with
  // exactly one Option whose text was all four choices run together,
  // because OPTION_START's greedy match swallowed embedded "B."/"C."/
  // "D." markers when a document put every option on one line instead
  // of one per line. This is that exact shape, confirmed directly
  // against the real broken document.
  it("splits four options that were all written on a single line", () => {
    const text = `
25. Understanding a blank spreadsheet field
A Zap successfully adds a new row to a spreadsheet, but one column is blank. The trigger data contains a value for that column. What is a likely cause?
A. The value was not mapped to that column B. The Zap has too many letters in its name C. The trigger always prevents data from being used D. The spreadsheet cannot contain text
Answer: A
`;
    const blocks = splitIntoQuestionBlocks(text);
    expect(blocks[0].options).toEqual([
      { label: "A", text: "The value was not mapped to that column" },
      { label: "B", text: "The Zap has too many letters in its name" },
      { label: "C", text: "The trigger always prevents data from being used" },
      { label: "D", text: "The spreadsheet cannot contain text" },
    ]);
  });

  it("does not split on a letter+period that occurs naturally inside an option's own text", () => {
    const text = `
2. Which tool is used?
A. A spreadsheet, e.g. Excel or Google Sheets
B. A word processor
C. A presentation tool
D. None of the above
Answer: A
`;
    const blocks = splitIntoQuestionBlocks(text);
    expect(blocks[0].options).toHaveLength(4);
    expect(blocks[0].options[0].text).toBe("A spreadsheet, e.g. Excel or Google Sheets");
  });
});
