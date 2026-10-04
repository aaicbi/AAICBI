/**
 * AI Assignment Engine — the core grading service. The whole point of
 * this feature: assess whether a student actually demonstrates
 * understanding, not whether their wording matches an expected answer.
 * Same house convention as every other AI touchpoint in this project
 * (extractQuestions.ts, analyzePerformance.ts) — one file, Claude via
 * @anthropic-ai/sdk, Zod-validated JSON, fence-stripped parse, a
 * retry before giving up. claude-sonnet-4-5 deliberately, not haiku —
 * this produces an actual grade a student and instructor both rely on,
 * so quality matters more than per-call cost here.
 *
 * Every rule below is a direct, deliberate encoding of the product
 * spec's own §10/§11/§12/§13/§14/§36 — this system prompt is not
 * generic "grade this" wording, it states the exact behavior required.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30_000 });

const CriterionScoreSchema = z.object({
  name: z.string(),
  score: z.number(),
  maximum: z.number(),
  reason: z.string(),
});

const AssessmentResponseSchema = z.object({
  score: z.number(),
  maximum_score: z.number(),
  criteria: z.array(CriterionScoreSchema),
  strengths: z.array(z.string()),
  areas_for_improvement: z.array(z.string()),
  feedback: z.string().min(1),
  confidence: z.number().min(0).max(1),
  needs_instructor_review: z.boolean(),
});
export type AssessmentResponse = z.infer<typeof AssessmentResponseSchema>;

export interface AssignmentAnswerToAssess {
  questionText: string;
  questionType: string;
  instructions: string | null;
  expectedAnswer: string | null;
  expectedConcepts: string[] | null;
  rubric: { name: string; maxMarks: number; description: string | null }[] | null;
  maxMarks: number;
  answerText: string;
}

export type AssessAnswerResult =
  | { ok: true; assessment: AssessmentResponse }
  | { ok: false; reason: string };

const SYSTEM_PROMPT = `You are an experienced academic assessor grading one student's answer to one assignment question. Your job is to evaluate whether the student demonstrates real understanding — not whether their wording matches a model answer.

Return exactly this JSON shape:
{
  "score": number,
  "maximum_score": number,
  "criteria": [{"name": string, "score": number, "maximum": number, "reason": string}],
  "strengths": string[],
  "areas_for_improvement": string[],
  "feedback": string,
  "confidence": number,
  "needs_instructor_review": boolean
}

Rules you must follow exactly:
- Evaluate MEANING, not wording. A student who explains the same idea in completely different words from any "expected answer" should receive full or near-full credit for that idea. Never require exact phrases or keyword matches.
- Award PARTIAL CREDIT proportionally. If the student demonstrates some but not all of the expected understanding (e.g. 3 of 5 expected concepts, or a correct idea with a weak explanation), score accordingly — never all-or-nothing.
- If a rubric with named criteria and per-criterion mark allocations is provided, you MUST score each criterion independently, and "criteria" must have exactly one entry per rubric criterion, each with that criterion's own maximum. The sum of your criterion scores must equal "score".
- If NO rubric is provided, score holistically against the question, the expected answer/concepts (if given), and general academic quality — "criteria" can then be a single entry (e.g. {"name": "Overall", "score": ..., "maximum": maximum_score, "reason": ...}) or omitted as an empty array if genuinely nothing to break down.
- NEVER invent a requirement the question, expected answer, or rubric doesn't actually state. If no expected answer or expected concepts are given at all, grade the response on its own academic merit against the question and any instructions alone — do not penalize the student for not matching something that was never specified.
- Identify what's genuinely MISSING (an expected concept the student didn't mention) separately from what's WRONG (a factually incorrect statement) — both matter, but they're different kinds of feedback.
- If the answer is irrelevant to the question, or far too short to meaningfully assess, say so plainly in "feedback" and score accordingly (usually very low, but still explain why rather than just returning 0 with no reasoning).
- "strengths": 1-4 specific things the student got right — never generic ("good work"). Name the actual concept or idea they demonstrated.
- "areas_for_improvement": 1-4 specific, actionable things — what's missing, what to add, what to fix. Never generic.
- "feedback": 2-5 sentences synthesizing the above into a short paragraph a student can actually learn from. Explain every real deduction — if marks were lost, say what was missing or wrong.
- "confidence": your own honest confidence (0 to 1) in this specific assessment. Lower it for: an ambiguous or multi-interpretation answer, a poorly-written but possibly-correct response, a technical answer whose correctness you're not fully certain of, or anything requiring specialist judgment you're unsure of.
- "needs_instructor_review": true whenever confidence is below roughly 0.7, OR the answer is borderline/ambiguous/outside the expected structure, OR you are a technical answer (SQL/code/formulas) you cannot fully verify the correctness of. When in doubt, flag it — a human catching an edge case costs little; a wrong grade going unreviewed costs more.
- Respond with ONLY the JSON object. No preamble, no markdown fences.`;

const MAX_ATTEMPTS = 2;

async function attemptAssessment(userPrompt: string): Promise<{ ok: true; data: AssessmentResponse } | { ok: false; reason: string }> {
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

  const result = AssessmentResponseSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: "AI response did not match the expected schema." };
  }
  return { ok: true, data: result.data };
}

/**
 * Never throws. On total failure (no API key, every attempt fails to
 * parse/validate, a network error) returns `{ ok: false, reason }` —
 * the caller (assignmentGrading.ts) treats this as "needs instructor
 * review, no AI score," never as a fabricated or zeroed grade. This is
 * the one real behavioral difference from analyzePerformance.ts's own
 * "return null on any failure": that function's caller can simply omit
 * an optional summary; this one grades a required submission, so the
 * failure has to route somewhere a human will see it.
 */
export async function assessAssignmentAnswer(input: AssignmentAnswerToAssess): Promise<AssessAnswerResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "ANTHROPIC_API_KEY is not set." };
  }

  const userPrompt = buildUserPrompt(input);
  let lastReason = "AI request did not produce a usable response.";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const outcome = await attemptAssessment(userPrompt);
      if (outcome.ok) {
        // Defensive clamp — never trust the model's own arithmetic
        // blindly even though the prompt asks for it to be consistent.
        const clampedScore = Math.max(0, Math.min(outcome.data.score, outcome.data.maximum_score));
        return { ok: true, assessment: { ...outcome.data, score: clampedScore } };
      }
      lastReason = outcome.reason;
    } catch (e) {
      lastReason = e instanceof Error ? e.message : "unknown error";
    }
  }
  return { ok: false, reason: `${lastReason} (retried ${MAX_ATTEMPTS} times)` };
}

function buildUserPrompt(input: AssignmentAnswerToAssess): string {
  const rubricText = input.rubric && input.rubric.length > 0
    ? input.rubric.map((c) => `- ${c.name} (${c.maxMarks} marks)${c.description ? `: ${c.description}` : ""}`).join("\n")
    : "(none provided — score holistically)";
  const conceptsText = input.expectedConcepts && input.expectedConcepts.length > 0
    ? input.expectedConcepts.join(", ")
    : "(none provided)";

  return `Question (${input.questionType}, ${input.maxMarks} marks):
${input.questionText}

${input.instructions ? `Instructions for this question: ${input.instructions}\n` : ""}
Expected answer (if provided by the instructor — the student's answer does NOT need to match this wording, only demonstrate the same understanding): ${input.expectedAnswer ?? "(none provided)"}

Expected concepts the student should demonstrate understanding of: ${conceptsText}

Rubric:
${rubricText}

Maximum marks for this question: ${input.maxMarks}

---
Student's answer:
${input.answerText || "(no answer provided)"}
---

Assess this answer now.`;
}
