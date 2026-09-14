/**
 * Stage 7 of the import pipeline (§32): send each raw question block
 * through Claude to structure it into clean JSON, and to classify a
 * topic/difficulty for it. This layer is intentionally the ONLY place
 * that talks to the AI provider — if you swap providers later, this is
 * the one file to change (§10, §30's "build an abstraction layer").
 *
 * Hard rule this file exists to enforce: the AI must never invent an
 * answer. If `rawBlock.answerLabel` is missing, we tell the model not to
 * guess, and we still flag the resulting question for human review
 * regardless of what the model returns — see needsReview below.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { RawQuestionBlock } from "@/lib/parsing/docxParser";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const StructuredQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(6),
  correct_option_index: z.number().int().min(0).max(5).nullable(),
  explanation: z.string().nullable(),
  topic: z.string().nullable(),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]).nullable(),
  confident: z.boolean(),
});
export type StructuredQuestion = z.infer<typeof StructuredQuestionSchema>;

export interface ExtractedQuestion {
  structured: StructuredQuestion;
  needsReview: boolean;
  reviewReason: string | null;
}

/**
 * Bug fix, pulled out as its own pure function for real unit-test
 * coverage (extractQuestion itself makes a live Anthropic call, so
 * this is the part of it that actually can be tested without mocking
 * the SDK): confirmed against a real import where every single
 * question came back "confident" with a non-null correct_option_index,
 * yet not one ended up matching any actual option — the index the
 * model returned never fell inside its own options array. The system
 * prompt didn't specify 0- vs. 1-indexed at the time, and the evidence
 * (options/question text extracted perfectly, only the index was ever
 * wrong) points at the model treating it as 1-indexed. If the reported
 * index is out of range but shifting it down by one lands inside the
 * array, treat it as a 1-indexed value and correct it — flagged as
 * corrected either way, since an index that needed correcting is
 * exactly the kind of "the model wasn't actually as reliable here as
 * it claimed" case a human should double-check, not something to
 * silently paper over. An index that's out of range even after that
 * correction is treated the same as no answer at all, per this file's
 * own "never invent an answer" rule — corrected to null rather than
 * left pointing at nothing.
 */
export function resolveCorrectOptionIndex(
  rawIndex: number | null,
  optionsLength: number
): { index: number | null; wasCorrected: boolean } {
  if (rawIndex === null) return { index: null, wasCorrected: false };
  if (rawIndex >= 0 && rawIndex < optionsLength) return { index: rawIndex, wasCorrected: false };

  const asOneIndexed = rawIndex - 1;
  if (asOneIndexed >= 0 && asOneIndexed < optionsLength) {
    return { index: asOneIndexed, wasCorrected: true };
  }
  return { index: null, wasCorrected: true };
}

// Bug fix: this prompt never told the model the full output shape —
// only correct_option_index/topic/difficulty/confident were ever named
// anywhere in the text it receives. "question", "options", and
// critically "explanation" were never mentioned at all, so the model
// had no signal an explanation field existed or was wanted, even when
// the source document had one written out for every question —
// confirmed directly against a real document that does include
// explanations, which still came back null for all 30 questions.
// Spelling out the exact JSON shape up front removes the ambiguity.
const SYSTEM_PROMPT = `You structure exam questions extracted from a Word document into clean JSON.

Return exactly this JSON shape:
{
  "question": string,               // the question text, cleaned up
  "options": string[],              // each option's text, cleaned up, WITHOUT the leading "A."/"B."/etc. label
  "correct_option_index": number | null,
  "explanation": string | null,
  "topic": string | null,
  "difficulty": "Beginner" | "Intermediate" | "Advanced" | null,
  "confident": boolean
}

Rules:
- Never invent a correct answer. If the source text does not clearly indicate which option is correct, set "correct_option_index" to null and "confident" to false.
- "correct_option_index" is ZERO-INDEXED: 0 means the first option in your "options" array (i.e. "A"), 1 means the second ("B"), and so on. Never 1-indexed.
- "explanation": if the source text includes a written explanation or rationale for why the answer is correct, extract it into this field — clean up whitespace only, don't rewrite or summarize it. If the source has no explanation for this question, use null. Never invent one.
- Do not change the meaning of the question or options — clean up whitespace and obvious OCR/formatting artifacts only.
- "topic" should be a short 2-4 word label (e.g. "Excel Formulas", "Data Cleaning"). If genuinely unclear, use null.
- "difficulty" is your best-effort estimate from the question's content alone — Beginner, Intermediate, or Advanced. Use null only if the question is too fragmentary to judge.
- Respond with ONLY the JSON object. No preamble, no markdown fences.`;

// Bug fix / resilience: confirmed directly (sent the exact real block
// text that failed during a live import to the API 3 times in a row —
// all 3 succeeded cleanly) that an occasional malformed response is
// real AI response variance, not a deterministic prompt bug. Retrying
// once before giving up turns most of these into a clean, automatic
// result instead of a manual-review item — directly serving the "we
// want this to be automated" goal, since a transient miss shouldn't
// cost a human a review pass when the very same input reliably
// succeeds on a second try.
const MAX_ATTEMPTS = 2;

/** One raw attempt: call the API, parse, validate. Returns the parsed
 * StructuredQuestion on success, or a string failure reason on any
 * kind of miss (no text / invalid JSON / schema mismatch) — the caller
 * decides whether to retry or give up. */
async function attemptExtraction(
  userPrompt: string
): Promise<{ ok: true; data: StructuredQuestion } | { ok: false; reason: string }> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500, // bumped from 1000 — extracting a real explanation now makes responses longer than before
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { ok: false, reason: "AI returned no text content." };
  }

  let parsed: unknown;
  try {
    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, reason: "AI response was not valid JSON." };
  }

  const result = StructuredQuestionSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: "AI response did not match the expected schema." };
  }

  return { ok: true, data: result.data };
}

export async function extractQuestion(block: RawQuestionBlock): Promise<ExtractedQuestion> {
  const userPrompt = buildUserPrompt(block);

  let lastReason = "AI request did not produce a usable response.";
  let structured: StructuredQuestion | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const outcome = await attemptExtraction(userPrompt);
    if (outcome.ok) {
      structured = outcome.data;
      break;
    }
    lastReason = outcome.reason;
  }

  if (!structured) {
    return unresolvedFallback(block, `${lastReason} (retried ${MAX_ATTEMPTS} times)`);
  }
  const { index: correctIndex, wasCorrected: indexWasCorrected } = resolveCorrectOptionIndex(
    structured.correct_option_index,
    structured.options.length
  );
  const correctedStructured = correctIndex === structured.correct_option_index ? structured : { ...structured, correct_option_index: correctIndex };

  const needsReview =
    !correctedStructured.confident ||
    correctedStructured.correct_option_index === null ||
    correctedStructured.options.length < 2 ||
    indexWasCorrected;

  return {
    structured: correctedStructured,
    needsReview,
    reviewReason: needsReview
      ? indexWasCorrected
        ? "The AI's answer index needed correcting (looked 1-indexed) — please verify the marked correct answer."
        : "Correct answer could not be confidently identified."
      : null,
  };
}

export async function extractQuestionsBatch(
  blocks: RawQuestionBlock[]
): Promise<ExtractedQuestion[]> {
  // Sequential on purpose — keeps this predictable under the sandboxed
  // rate limits most training orgs are on. If you're importing hundreds
  // of questions regularly, batch these with a small concurrency pool
  // (e.g. 3-5 at a time) rather than firing them all at once.
  const results: ExtractedQuestion[] = [];
  for (const block of blocks) {
    try {
      results.push(await extractQuestion(block));
    } catch (e) {
      results.push(
        unresolvedFallback(
          block,
          `AI request failed: ${e instanceof Error ? e.message : "unknown error"}`
        )
      );
    }
  }
  return results;
}

function buildUserPrompt(block: RawQuestionBlock): string {
  const optionsHint =
    block.options.length > 0
      ? block.options.map((o) => `${o.label}) ${o.text}`).join("\n")
      : "(no options were confidently detected — look for them in the raw text below)";

  return `Raw question block extracted from a Word document:

---
${block.rawText}
---

Options detected by the pre-parser (may be incomplete or wrong — verify against the raw text above):
${optionsHint}

Answer detected by the pre-parser: ${block.answerLabel ?? "none detected"}

Structure this into the required JSON format.`;
}

function unresolvedFallback(block: RawQuestionBlock, reason: string): ExtractedQuestion {
  // We could not process this question automatically (§33) — surface it
  // as a fully-flagged manual-review item rather than dropping it, so the
  // admin still sees every question the parser found.
  return {
    structured: {
      question: block.questionText ?? block.rawText.slice(0, 200),
      options: block.options.map((o) => o.text),
      correct_option_index: null,
      explanation: null,
      topic: null,
      difficulty: null,
      confident: false,
    },
    needsReview: true,
    reviewReason: reason,
  };
}
