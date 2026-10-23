/**
 * Rules for a question typed in by hand, shared by the form (so mistakes show before saving) and the server (which does not trust the form).
 * Pure, so every rule is tested. A question is single choice: two to six options, exactly one correct, no two options the same.
 */
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
export const TEXT_MAX = 2000;
export const OPTION_MAX = 500;
export const EXPLANATION_MAX = 2000;

export interface DraftOption { text: string; isCorrect: boolean }
export interface QuestionDraft { text: string; options: DraftOption[]; topic?: string; explanation?: string }

const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Tidies a draft: trims, collapses spaces, drops empty options. The same tidy-up runs before saving and before checking. */
export function tidyDraft(d: QuestionDraft): QuestionDraft {
  return {
    text: d.text.trim(),
    topic: d.topic?.trim() || undefined,
    explanation: d.explanation?.trim() || undefined,
    options: d.options.map((o) => ({ text: norm(o.text), isCorrect: o.isCorrect })).filter((o) => o.text.length > 0),
  };
}

/** The first thing wrong with a question, in plain words, or null when it can be saved. */
export function questionDraftProblem(raw: QuestionDraft): string | null {
  const d = tidyDraft(raw);
  if (d.text.length < 3) return "Write the question.";
  if (d.text.length > TEXT_MAX) return `Keep the question under ${TEXT_MAX} characters.`;
  if (d.options.length < MIN_OPTIONS) return `Give at least ${MIN_OPTIONS} answer options.`;
  if (d.options.length > MAX_OPTIONS) return `Use at most ${MAX_OPTIONS} answer options.`;
  if (d.options.some((o) => o.text.length > OPTION_MAX)) return `Keep each option under ${OPTION_MAX} characters.`;
  const seen = new Set<string>();
  for (const o of d.options) {
    const k = o.text.toLowerCase();
    if (seen.has(k)) return `Two options say the same thing: "${o.text}". Change one.`;
    seen.add(k);
  }
  const correct = d.options.filter((o) => o.isCorrect).length;
  if (correct === 0) return "Mark the correct answer.";
  if (correct > 1) return "Mark only one correct answer.";
  if ((d.explanation?.length ?? 0) > EXPLANATION_MAX) return `Keep the explanation under ${EXPLANATION_MAX} characters.`;
  return null;
}
