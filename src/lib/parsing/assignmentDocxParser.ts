/**
 * AI Assignment Engine — the assignment-document counterpart to
 * docxParser.ts's splitIntoQuestionBlocks. Deliberately dumb and
 * regex-based, same philosophy as that file's own header comment:
 * find the boundaries between questions and pull out the obvious
 * labeled parts (title, instructions, marks, a rubric line, an
 * explicit "Expected Answer"/"Expected Concepts" section), but don't
 * try to be clever about ambiguous cases — that's exactly what the AI
 * structuring step (src/lib/ai/extractAssignmentQuestions.ts) and the
 * instructor review screen are for.
 *
 * extractTextFromDocx (mammoth-based plain text extraction) is reused
 * as-is from docxParser.ts — nothing about pulling text out of a
 * .docx file is specific to multiple-choice questions.
 *
 * Every label is tolerant of BOTH "LABEL: value" on one line AND
 * "LABEL:" on its own line with the value on the next — confirmed
 * directly against the spec's own worked example, which uses the
 * second form throughout ("MARKS:\n10", "ASSIGNMENT TITLE:\nIntroduction
 * to Data Analysis"), not the first.
 */

export interface RawAssignmentBlock {
  rawText: string; // the full block, unparsed — always kept for AI fallback/audit
  questionNumber: string | null;
  questionText: string | null;
  instructionsHint: string | null;
  expectedAnswerHint: string | null;
  expectedConceptsHint: string[];
  marksHint: number | null;
  rubricHint: { name: string; maxMarks: number }[];
  learningObjectiveHint: string | null;
}

export interface ParsedAssignmentDocument {
  title: string | null;
  instructions: string | null;
  blocks: RawAssignmentBlock[];
}

const MAX_REASONABLE_QUESTIONS = 300;

export class AssignmentDocxParseError extends Error {}

// "QUESTION 1:", "Question 1.", "1)", or a bare "QUESTION 1" on its own
// line — same tolerant shape as docxParser.ts's own QUESTION_START,
// reused deliberately rather than reinvented.
const QUESTION_START = /^(?:question\s*)?\d{1,3}[).:]\s*|^question\s+\d{1,3}\s*$/i;

const TITLE_LABEL = /^assignment\s*title\s*:\s*(.*)$/i;
const INSTRUCTIONS_LABEL = /^instructions?\s*:\s*(.*)$/i;
const EXPECTED_ANSWER_LABEL = /^expected\s*answer\s*:\s*(.*)$/i;
const EXPECTED_CONCEPTS_LABEL = /^expected\s*concepts?\s*:\s*(.*)$/i;
const MARKS_LABEL = /^marks?\s*:\s*(\d*)\s*$/i;
const RUBRIC_LABEL = /^rubric\s*:?\s*(.*)$/i;
const RUBRIC_CRITERION_LINE = /^(.+?)\s*[—\-]\s*(\d+)\s*marks?\s*$/i;
const LEARNING_OBJECTIVE_LABEL = /^learning\s*objectives?\s*:\s*(.*)$/i;
// A plain "- " or "* " bullet, used under EXPECTED CONCEPTS:.
const BULLET_LINE = /^[-*•]\s+(.*)$/;

type MultiLineSection = "concepts" | "rubric" | "answer" | null;
type PendingSingleValue = "docTitle" | "docInstructions" | "marks" | "objective" | null;

export function splitIntoAssignmentBlocks(rawText: string): ParsedAssignmentDocument {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let title: string | null = null;
  let instructions: string | null = null;
  const blocks: RawAssignmentBlock[] = [];
  let current: RawAssignmentBlock | null = null;
  let rawLines: string[] = [];
  let multiLineSection: MultiLineSection = null;
  // A label with nothing after the colon on its own line — the NEXT
  // line (if it isn't itself a label/question-start) becomes that
  // field's value, then this clears. Covers the spec's own
  // "MARKS:\n10" / "ASSIGNMENT TITLE:\nIntroduction..." shape.
  let pendingSingleValue: PendingSingleValue = null;

  const flush = () => {
    if (current) {
      current.rawText = rawLines.join("\n");
      blocks.push(current);
    }
    current = null;
    rawLines = [];
    multiLineSection = null;
    pendingSingleValue = null;
  };

  for (const line of lines) {
    // A pending single-value label consumes this line as its value,
    // UNLESS this line is itself a new label or question start — in
    // that case the pending label simply had no value, which is
    // honest (never inventing one), not an error.
    if (pendingSingleValue) {
      const isAnotherLabelOrQuestion =
        QUESTION_START.test(line) ||
        TITLE_LABEL.test(line) ||
        INSTRUCTIONS_LABEL.test(line) ||
        EXPECTED_ANSWER_LABEL.test(line) ||
        EXPECTED_CONCEPTS_LABEL.test(line) ||
        MARKS_LABEL.test(line) ||
        RUBRIC_LABEL.test(line) ||
        LEARNING_OBJECTIVE_LABEL.test(line);
      if (!isAnotherLabelOrQuestion) {
        if (pendingSingleValue === "docTitle") title = line;
        else if (pendingSingleValue === "docInstructions") instructions = line;
        else if (pendingSingleValue === "marks" && current) current.marksHint = parseInt(line, 10) || null;
        else if (pendingSingleValue === "objective" && current) current.learningObjectiveHint = line;
        pendingSingleValue = null;
        if (current) rawLines.push(line);
        continue;
      }
      pendingSingleValue = null;
      // fall through — this line is handled normally below.
    }

    if (!current) {
      const titleMatch = line.match(TITLE_LABEL);
      const instructionsMatch = line.match(INSTRUCTIONS_LABEL);
      if (titleMatch) {
        if (titleMatch[1].trim()) title = titleMatch[1].trim();
        else pendingSingleValue = "docTitle";
        continue;
      }
      if (instructionsMatch) {
        if (instructionsMatch[1].trim()) instructions = instructionsMatch[1].trim();
        else pendingSingleValue = "docInstructions";
        continue;
      }
    }

    const qMatch = line.match(QUESTION_START);
    if (qMatch) {
      flush();
      const numberText = line.match(/\d{1,3}/)?.[0] ?? null;
      const textAfterLabel = line.replace(QUESTION_START, "").trim();
      current = {
        rawText: "",
        questionNumber: numberText,
        questionText: textAfterLabel || null,
        instructionsHint: null,
        expectedAnswerHint: null,
        expectedConceptsHint: [],
        marksHint: null,
        rubricHint: [],
        learningObjectiveHint: null,
      };
      rawLines = [line];
      continue;
    }

    if (!current) {
      // Front-matter before the first detected question (title page,
      // general instructions not using a recognized label) is
      // intentionally dropped — same as docxParser.ts's own behavior.
      continue;
    }

    rawLines.push(line);

    const expectedAnswerMatch = line.match(EXPECTED_ANSWER_LABEL);
    const expectedConceptsMatch = line.match(EXPECTED_CONCEPTS_LABEL);
    const marksMatch = line.match(MARKS_LABEL);
    const rubricMatch = line.match(RUBRIC_LABEL);
    const objectiveMatch = line.match(LEARNING_OBJECTIVE_LABEL);
    const bulletMatch = line.match(BULLET_LINE);
    const rubricCriterionMatch = line.match(RUBRIC_CRITERION_LINE);

    if (expectedAnswerMatch) {
      if (expectedAnswerMatch[1].trim()) {
        multiLineSection = "answer";
        current.expectedAnswerHint = expectedAnswerMatch[1].trim();
      } else {
        multiLineSection = "answer";
      }
    } else if (expectedConceptsMatch) {
      multiLineSection = "concepts";
      if (expectedConceptsMatch[1].trim()) current.expectedConceptsHint.push(expectedConceptsMatch[1].trim());
    } else if (marksMatch) {
      multiLineSection = null;
      if (marksMatch[1].trim()) current.marksHint = parseInt(marksMatch[1], 10);
      else pendingSingleValue = "marks";
    } else if (objectiveMatch) {
      multiLineSection = null;
      if (objectiveMatch[1].trim()) current.learningObjectiveHint = objectiveMatch[1].trim();
      else pendingSingleValue = "objective";
    } else if (rubricMatch) {
      multiLineSection = "rubric";
      if (rubricMatch[1].trim()) {
        const inline = rubricMatch[1].match(RUBRIC_CRITERION_LINE);
        if (inline) current.rubricHint.push({ name: inline[1].trim(), maxMarks: parseInt(inline[2], 10) });
      }
    } else if (multiLineSection === "rubric" && rubricCriterionMatch) {
      current.rubricHint.push({ name: rubricCriterionMatch[1].trim(), maxMarks: parseInt(rubricCriterionMatch[2], 10) });
    } else if (multiLineSection === "concepts" && bulletMatch) {
      current.expectedConceptsHint.push(bulletMatch[1].trim());
    } else if (multiLineSection === "concepts") {
      // A concepts line with no bullet marker — still a concept, one
      // per line, same tolerant spirit as the bulleted case.
      current.expectedConceptsHint.push(line);
    } else if (multiLineSection === "answer") {
      current.expectedAnswerHint = current.expectedAnswerHint ? `${current.expectedAnswerHint} ${line}` : line;
    } else if (multiLineSection === null) {
      // Plain continuation of the question text itself — includes
      // multi-part sub-labels ("a. Define...") inline; splitting a
      // MULTI_PART question into its parts is the AI structuring
      // step's job, not this parser's.
      current.questionText = current.questionText ? `${current.questionText}\n${line}` : line;
    }
  }
  flush();

  if (blocks.length === 0) {
    throw new AssignmentDocxParseError(
      "We could not identify any numbered questions in this document. Please check the document format and try again."
    );
  }
  if (blocks.length > MAX_REASONABLE_QUESTIONS) {
    throw new AssignmentDocxParseError(
      `Detected ${blocks.length} question blocks, which is unusually high — check the document isn't being split incorrectly before importing.`
    );
  }

  return { title, instructions, blocks };
}
