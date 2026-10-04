/**
 * AI Assignment Engine — the assignment counterpart to
 * src/lib/ai/extractQuestions.ts: sends each raw question block
 * (src/lib/parsing/assignmentDocxParser.ts) through Claude to structure
 * it into clean JSON. Same house convention that file establishes: this
 * is the ONE place that talks to the AI provider for this step.
 *
 * Same hard rule, restated for this domain: the AI must never invent an
 * expected answer, a concept list, a rubric, or a mark allocation that
 * the source text doesn't actually contain. The pre-parser's own hints
 * (src/lib/parsing/assignmentDocxParser.ts's RawAssignmentBlock) are
 * passed through as a strong signal, not overridden — if the pre-parser
 * found nothing for a field, the model is told explicitly not to guess.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { RawAssignmentBlock } from "@/lib/parsing/assignmentDocxParser";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const QUESTION_TYPES = [
  "SHORT_ANSWER",
  "EXPLANATION",
  "LONG_ANSWER",
  "ESSAY",
  "SCENARIO",
  "CASE_STUDY",
  "PRACTICAL_TASK",
  "TECHNICAL_RESPONSE",
  "REFLECTION",
  "MULTI_PART",
] as const;

const RubricCriterionSchema = z.object({
  name: z.string(),
  maxMarks: z.number().int().positive(),
  description: z.string().nullable(),
});

const StructuredAssignmentQuestionSchema = z.object({
  question: z.string(),
  type: z.enum(QUESTION_TYPES),
  instructions: z.string().nullable(),
  expectedAnswer: z.string().nullable(),
  expectedConcepts: z.array(z.string()).nullable(),
  keywords: z.array(z.string()).nullable(),
  learningObjective: z.string().nullable(),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]).nullable(),
  marks: z.number().int().positive().nullable(),
  rubric: z.array(RubricCriterionSchema).nullable(),
  confident: z.boolean(),
});
export type StructuredAssignmentQuestion = z.infer<typeof StructuredAssignmentQuestionSchema>;

export interface ExtractedAssignmentQuestion {
  structured: StructuredAssignmentQuestion;
  needsReview: boolean;
  reviewReason: string | null;
}

const SYSTEM_PROMPT = `You structure assignment questions extracted from a Word document into clean JSON. These are open-ended, free-text assignment questions — NOT multiple choice.

Return exactly this JSON shape:
{
  "question": string,                 // the question text, cleaned up — never change its meaning
  "type": "SHORT_ANSWER" | "EXPLANATION" | "LONG_ANSWER" | "ESSAY" | "SCENARIO" | "CASE_STUDY" | "PRACTICAL_TASK" | "TECHNICAL_RESPONSE" | "REFLECTION" | "MULTI_PART",
  "instructions": string | null,      // any instruction specific to this question, distinct from the question itself
  "expectedAnswer": string | null,
  "expectedConcepts": string[] | null,
  "keywords": string[] | null,
  "learningObjective": string | null,
  "difficulty": "Beginner" | "Intermediate" | "Advanced" | null,
  "marks": number | null,
  "rubric": [{"name": string, "maxMarks": number, "description": string | null}] | null,
  "confident": boolean
}

Hard rules:
- NEVER invent an expected answer, expected concepts, a rubric, or a mark allocation. If the source text (including the pre-parser's own hints below) does not clearly provide one of these, use null for it. Set "confident" to false if the question is missing marks or both an expected answer and expected concepts — those are the two things a real instructor almost always provides, and their absence usually means the parser missed something, not that the document genuinely omits them.
- Do not change the meaning of the question text — clean up whitespace and obvious formatting artifacts only.
- Classify "type" from the question's own phrasing: "explain" → EXPLANATION, a case/scenario description → SCENARIO or CASE_STUDY, "write SQL/Python/a formula" → TECHNICAL_RESPONSE, "reflect on what you learned" → REFLECTION, multiple labeled sub-parts (a, b, c...) → MULTI_PART, otherwise judge by length/depth expected (SHORT_ANSWER, LONG_ANSWER, or ESSAY).
- "difficulty" is your best-effort estimate from the question's own content. Use null only if genuinely too fragmentary to judge.
- Respond with ONLY the JSON object. No preamble, no markdown fences.`;

const MAX_ATTEMPTS = 2;

async function attemptExtraction(
  userPrompt: string
): Promise<{ ok: true; data: StructuredAssignmentQuestion } | { ok: false; reason: string }> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2000,
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

  const result = StructuredAssignmentQuestionSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: "AI response did not match the expected schema." };
  }
  return { ok: true, data: result.data };
}

export async function extractAssignmentQuestion(block: RawAssignmentBlock): Promise<ExtractedAssignmentQuestion> {
  const userPrompt = buildUserPrompt(block);

  let lastReason = "AI request did not produce a usable response.";
  let structured: StructuredAssignmentQuestion | null = null;
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

  const missingMarks = structured.marks === null;
  const missingAnswerAndConcepts =
    !structured.expectedAnswer && (!structured.expectedConcepts || structured.expectedConcepts.length === 0);
  const needsReview = !structured.confident || missingMarks;

  let reviewReason: string | null = null;
  if (needsReview) {
    if (missingMarks) reviewReason = "No mark allocation could be found for this question — please add one before publishing.";
    else if (missingAnswerAndConcepts) reviewReason = "No expected answer or expected concepts were found — AI assessment will grade holistically.";
    else reviewReason = "The AI was not fully confident in how this question was extracted — please verify.";
  }

  return { structured, needsReview, reviewReason };
}

export async function extractAssignmentQuestionsBatch(
  blocks: RawAssignmentBlock[]
): Promise<ExtractedAssignmentQuestion[]> {
  // Sequential on purpose — same predictable-rate-limit reasoning as
  // extractQuestionsBatch in extractQuestions.ts.
  const results: ExtractedAssignmentQuestion[] = [];
  for (const block of blocks) {
    try {
      results.push(await extractAssignmentQuestion(block));
    } catch (e) {
      results.push(unresolvedFallback(block, `AI request failed: ${e instanceof Error ? e.message : "unknown error"}`));
    }
  }
  return results;
}

function buildUserPrompt(block: RawAssignmentBlock): string {
  return `Raw question block extracted from a Word document:

---
${block.rawText}
---

Pre-parser hints (may be incomplete — verify against the raw text above, and treat an empty hint as "the pre-parser found nothing," not as license to invent one):
- Question number: ${block.questionNumber ?? "not detected"}
- Question text guess: ${block.questionText ?? "not detected"}
- Expected answer hint: ${block.expectedAnswerHint ?? "none found"}
- Expected concepts hint: ${block.expectedConceptsHint.length > 0 ? block.expectedConceptsHint.join("; ") : "none found"}
- Marks hint: ${block.marksHint ?? "none found"}
- Rubric hint: ${block.rubricHint.length > 0 ? block.rubricHint.map((r) => `${r.name} — ${r.maxMarks} marks`).join("; ") : "none found"}
- Learning objective hint: ${block.learningObjectiveHint ?? "none found"}

Structure this into the required JSON format.`;
}

function unresolvedFallback(block: RawAssignmentBlock, reason: string): ExtractedAssignmentQuestion {
  // We could not process this question automatically — surface it as a
  // fully-flagged manual-review item rather than dropping it, so the
  // instructor still sees every question the parser found.
  return {
    structured: {
      question: block.questionText ?? block.rawText.slice(0, 300),
      type: "SHORT_ANSWER",
      instructions: null,
      expectedAnswer: block.expectedAnswerHint,
      expectedConcepts: block.expectedConceptsHint.length > 0 ? block.expectedConceptsHint : null,
      keywords: null,
      learningObjective: block.learningObjectiveHint,
      difficulty: null,
      marks: block.marksHint,
      rubric: block.rubricHint.length > 0 ? block.rubricHint.map((r) => ({ name: r.name, maxMarks: r.maxMarks, description: null })) : null,
      confident: false,
    },
    needsReview: true,
    reviewReason: reason,
  };
}
