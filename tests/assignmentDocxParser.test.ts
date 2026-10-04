import { describe, it, expect } from "vitest";
import { splitIntoAssignmentBlocks, AssignmentDocxParseError } from "@/lib/parsing/assignmentDocxParser";

describe("splitIntoAssignmentBlocks", () => {
  it("parses the spec's own example format: title, instructions, expected concepts, marks", () => {
    const text = `
ASSIGNMENT TITLE:
Introduction to Data Analysis

INSTRUCTIONS:
Answer all questions using examples where necessary.

QUESTION 1:
Explain why data cleaning is important in data analysis.

EXPECTED CONCEPTS:
- Missing data
- Incorrect data
- Data consistency
- Reliable analysis

MARKS:
10
`;
    const doc = splitIntoAssignmentBlocks(text);
    expect(doc.title).toBe("Introduction to Data Analysis");
    expect(doc.instructions).toBe("Answer all questions using examples where necessary.");
    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0].questionNumber).toBe("1");
    expect(doc.blocks[0].questionText).toContain("Explain why data cleaning is important");
    expect(doc.blocks[0].expectedConceptsHint).toEqual(["Missing data", "Incorrect data", "Data consistency", "Reliable analysis"]);
    expect(doc.blocks[0].marksHint).toBe(10);
  });

  it("parses a rubric with per-criterion mark allocations", () => {
    const text = `
QUESTION 1:
Explain the importance of data cleaning.

MARKS:
10

RUBRIC:
Understanding — 3 marks
Accuracy — 3 marks
Application — 2 marks
Explanation — 2 marks
`;
    const doc = splitIntoAssignmentBlocks(text);
    expect(doc.blocks[0].rubricHint).toEqual([
      { name: "Understanding", maxMarks: 3 },
      { name: "Accuracy", maxMarks: 3 },
      { name: "Application", maxMarks: 2 },
      { name: "Explanation", maxMarks: 2 },
    ]);
  });

  it("captures an expected answer when the document provides one", () => {
    const text = `
QUESTION 1:
What is 2+2?

EXPECTED ANSWER:
Four.

MARKS:
2
`;
    const doc = splitIntoAssignmentBlocks(text);
    expect(doc.blocks[0].expectedAnswerHint).toBe("Four.");
  });

  it("does not invent an expected answer, concepts, or rubric when none are present", () => {
    const text = `
QUESTION 1:
Reflect on what you learned this week.

MARKS:
5
`;
    const doc = splitIntoAssignmentBlocks(text);
    expect(doc.blocks[0].expectedAnswerHint).toBeNull();
    expect(doc.blocks[0].expectedConceptsHint).toEqual([]);
    expect(doc.blocks[0].rubricHint).toEqual([]);
  });

  it("splits multiple questions in one document", () => {
    const text = `
QUESTION 1:
First question.

MARKS:
5

QUESTION 2:
Second question.

MARKS:
5
`;
    const doc = splitIntoAssignmentBlocks(text);
    expect(doc.blocks).toHaveLength(2);
    expect(doc.blocks[0].questionNumber).toBe("1");
    expect(doc.blocks[1].questionNumber).toBe("2");
  });

  it("captures a learning objective line", () => {
    const text = `
QUESTION 1:
Explain data cleaning.

LEARNING OBJECTIVE:
Understand the role of data quality in analysis.

MARKS:
10
`;
    const doc = splitIntoAssignmentBlocks(text);
    expect(doc.blocks[0].learningObjectiveHint).toBe("Understand the role of data quality in analysis.");
  });

  it("throws AssignmentDocxParseError when no numbered questions are found", () => {
    expect(() => splitIntoAssignmentBlocks("Just some unrelated paragraph text.")).toThrow(AssignmentDocxParseError);
  });

  it("preserves the full raw text of a block for AI fallback, even content not matched by any label", () => {
    const text = `
QUESTION 1:
Describe your approach to this practical task.

Some free-form continuation text that doesn't match any known label.

MARKS:
10
`;
    const doc = splitIntoAssignmentBlocks(text);
    expect(doc.blocks[0].rawText).toContain("free-form continuation text");
  });
});
