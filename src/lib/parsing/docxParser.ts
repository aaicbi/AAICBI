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

// Matches a NEXT option marker embedded further along a line that
// already matched OPTION_START — e.g. the " B. " inside "...that
// column B. The Zap has too many letters...". Requires a leading space
// so this never fires mid-word.
const INLINE_OPTION_MARKER = /\s([A-Da-d])[).]\s+/g;

/**
 * Bug fix: OPTION_START's `(.*)$` is greedy, so a document that puts
 * all four options on ONE line (common — many authors don't press
 * Enter between "A. ..." and "B. ...") had every option after the
 * first silently swallowed into option A's own text, confirmed
 * directly against a real import: every question in an affected
 * document ended up with exactly one Option row whose text was all
 * four choices run together, and — since there was only ever one
 * option — no correct answer could ever be marked, which is exactly
 * why the result screen had nothing to highlight as correct.
 *
 * This looks for the NEXT option letters in strict sequence (A, then
 * B, then C, then D) within the text OPTION_START already captured,
 * and splits on those boundaries. Sequence-strict on purpose — a
 * stray "B)" or "C." that happens to occur naturally inside an
 * option's own prose won't match unless it's genuinely the next
 * expected letter, so this only activates for the real inline-options
 * case, not just any line containing a letter+period. Finds nothing to
 * split on (the normal one-option-per-line case, or a genuinely
 * ambiguous line) → returns the single option unchanged, same as
 * before this fix; never invents structure it isn't confident about,
 * matching this file's own stated "don't guess" design.
 */
function splitInlineOptions(startLabel: string, text: string): { label: string; text: string }[] {
  const boundaries: { index: number; length: number; label: string }[] = [];
  let expected = String.fromCharCode(startLabel.charCodeAt(0) + 1);

  INLINE_OPTION_MARKER.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_OPTION_MARKER.exec(text)) !== null) {
    const label = match[1].toUpperCase();
    if (label === expected && expected <= "D") {
      boundaries.push({ index: match.index, length: match[0].length, label });
      expected = String.fromCharCode(expected.charCodeAt(0) + 1);
    }
  }

  if (boundaries.length === 0) {
    return [{ label: startLabel, text: text.trim() }];
  }

  const results: { label: string; text: string }[] = [];
  let cursor = 0;
  let currentLabel = startLabel;
  for (const b of boundaries) {
    results.push({ label: currentLabel, text: text.slice(cursor, b.index).trim() });
    cursor = b.index + b.length;
    currentLabel = b.label;
  }
  results.push({ label: currentLabel, text: text.slice(cursor).trim() });
  return results;
}

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
      current.options.push(...splitInlineOptions(optMatch[1].toUpperCase(), optMatch[2]));
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
