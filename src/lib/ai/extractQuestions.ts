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

const SYSTEM_PROMPT = `You structure exam questions extracted from a Word document into clean JSON.

Rules:
- Never invent a correct answer. If the source text does not clearly indicate which option is correct, set "correct_option_index" to null and "confident" to false.
- Do not change the meaning of the question or options — clean up whitespace and obvious OCR/formatting artifacts only.
- "topic" should be a short 2-4 word label (e.g. "Excel Formulas", "Data Cleaning"). If genuinely unclear, use null.
- "difficulty" is your best-effort estimate from the question's content alone — Beginner, Intermediate, or Advanced. Use null only if the question is too fragmentary to judge.
- Respond with ONLY the JSON object. No preamble, no markdown fences.`;

export async function extractQuestion(block: RawQuestionBlock): Promise<ExtractedQuestion> {
  const userPrompt = buildUserPrompt(block);

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return unresolvedFallback(block, "AI returned no text content.");
  }

  let parsed: unknown;
  try {
    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return unresolvedFallback(block, "AI response was not valid JSON.");
  }

  const result = StructuredQuestionSchema.safeParse(parsed);
  if (!result.success) {
    return unresolvedFallback(block, "AI response did not match the expected schema.");
  }

  const structured = result.data;
  const needsReview =
    !structured.confident ||
    structured.correct_option_index === null ||
    structured.options.length < 2;

  return {
    structured,
    needsReview,
    reviewReason: needsReview
      ? "Correct answer could not be confidently identified."
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
