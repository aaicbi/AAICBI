/**
 * Stages 1-6 of the import pipeline (master prompt §32): validate the
 * file, pull out plain text, then split it into raw question blocks
 * before anything gets handed to the AI structuring layer.
 *
 * This stays deliberately dumb and regex-based. The goal here is only to
 * find the *boundaries* between questions and pull out the obvious parts
 * (numbering, option letters, an explicit "Answer:" line if present) —
 * it tolerates the formatting variants in §9 ("A." vs "a)", "Answer:" vs
 * "Correct Answer:") but doesn't try to be clever about ambiguous cases.
 * Anything genuinely ambiguous is exactly what the AI structuring step
 * (src/lib/ai/extractQuestions.ts) and the human review screen are for —
 * don't add guessing heuristics here that could silently misfile an
 * option as the wrong question.
 */
import mammoth from "mammoth";

export interface RawQuestionBlock {
  rawText: string; // the full block, unparsed — always kept for AI fallback / audit
  questionText: string | null;
  options: { label: string; text: string }[];
  answerLabel: string | null; // e.g. "A" — null if no explicit answer line found
}

const MAX_REASONABLE_QUESTIONS = 500;

export class DocxParseError extends Error {}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  let result;
  try {
    result = await mammoth.extractRawText({ buffer });
  } catch (e) {
    throw new DocxParseError(
      "Invalid file. Please upload a Microsoft Word (.docx) document."
    );
  }
  const text = result.value.trim();
  if (!text) {
    throw new DocxParseError(
      "This document appears to be empty, or its content could not be read."
    );
  }
  return text;
}

// Matches "1.", "1)", "Question 1:", "Question 1." at the start of a line.
const QUESTION_START = /^(?:question\s*)?(\d{1,3})[).:]\s+/i;

// Matches "A.", "A)", "a.", "a)" at the start of a line.
const OPTION_START = /^([A-Da-d])[).]\s+(.*)$/;

// Matches "Answer: A", "Correct Answer: a)", "Answer: A)" etc.
const ANSWER_LINE = /^(?:correct\s+answer|answer)\s*:\s*\(?([A-Da-d])\)?/i;

export function splitIntoQuestionBlocks(rawText: string): RawQuestionBlock[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const blocks: RawQuestionBlock[] = [];
  let current: RawQuestionBlock | null = null;
  let rawLines: string[] = [];

  const flush = () => {
    if (current) {
      current.rawText = rawLines.join("\n");
      blocks.push(current);
    }
    current = null;
    rawLines = [];
  };

  for (const line of lines) {
    const qMatch = line.match(QUESTION_START);
    const optMatch = line.match(OPTION_START);
    const ansMatch = line.match(ANSWER_LINE);

    if (qMatch) {
      flush();
      current = {
        rawText: "",
        questionText: line.replace(QUESTION_START, "").trim(),
        options: [],
        answerLabel: null,
      };
      rawLines = [line];
    } else if (current && optMatch) {
      current.options.push({ label: optMatch[1].toUpperCase(), text: optMatch[2].trim() });
      rawLines.push(line);
    } else if (current && ansMatch) {
      current.answerLabel = ansMatch[1].toUpperCase();
      rawLines.push(line);
    } else if (current) {
      // Continuation line (question text wrapped across lines, or an
      // explanation line) — append to question text if we haven't hit
      // options yet, otherwise just keep it in rawText for the AI step.
      if (current.options.length === 0 && current.questionText !== null) {
        current.questionText += " " + line;
      }
      rawLines.push(line);
    }
    // Lines before the first detected question number are front matter
    // (title pages, instructions) — intentionally dropped.
  }
  flush();

  if (blocks.length === 0) {
    throw new DocxParseError(
      "We could not identify any multiple-choice questions in this document. Please check the document format and try again."
    );
  }
  if (blocks.length > MAX_REASONABLE_QUESTIONS) {
    throw new DocxParseError(
      `Detected ${blocks.length} question blocks, which is unusually high — check the document isn't being split incorrectly before importing.`
    );
  }

  return blocks;
}
