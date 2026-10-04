/**
 * AI Assignment Engine — rolls the already-computed per-question AI
 * assessments into one overall {strengths, areasForImprovement,
 * feedback} triple for the submission. Same model-tier reasoning as
 * analyzePerformance.ts: this is a "synthesize already-computed
 * results into a short narrative" task, not a judgment call that needs
 * sonnet — claude-haiku-4-5, cheaper and faster.
 *
 * Grounded ONLY in the per-question scores/feedback already produced
 * by assessAssignmentAnswer.ts — never re-reads the raw student answer
 * text itself, same "nothing here for the model to hallucinate FROM"
 * anti-hallucination boundary analyzePerformance.ts's own comment
 * describes for its own input.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 15_000 });

const OverallFeedbackSchema = z.object({
  strengths: z.array(z.string()).max(6),
  areasForImprovement: z.array(z.string()).max(6),
  feedback: z.string().min(1),
});
export type OverallFeedbackResult = z.infer<typeof OverallFeedbackSchema>;

export interface PerQuestionResult {
  questionNumber: string;
  score: number | null;
  maxScore: number;
  strengths: string[];
  areasForImprovement: string[];
}

const SYSTEM_PROMPT = `You write a short, honest overall summary for a student who just completed an assignment, based ONLY on the per-question results you're given. You have no other information — never invent a fact not present in the data provided.

Return exactly this JSON shape:
{
  "strengths": string[],
  "areasForImprovement": string[],
  "feedback": string
}

Rules:
- "strengths": roll up the recurring/strongest themes across the per-question strengths you were given — don't just repeat them verbatim per question, synthesize into a few genuinely useful overall observations.
- "areasForImprovement": same synthesis for the per-question areas for improvement — the concepts or skills most worth the student practicing next.
- "feedback": 2-4 sentences, plain and encouraging, naming the strongest and weakest areas and one concrete, actionable suggestion for what to focus on next.
- A question with a null score (still pending instructor review) should be treated as "not yet assessed," never as a zero or a weakness.
- Respond with ONLY the JSON object. No preamble, no markdown fences.`;

/**
 * Returns null on any failure — same graceful-degradation contract as
 * generatePerformanceSummary. Unlike per-question AI assessment, an
 * overall narrative is a genuine nice-to-have: the submission's real,
 * required score is already the sum of the per-question scores
 * regardless of whether this synthesis step succeeds.
 */
export async function generateAssignmentOverallFeedback(results: PerQuestionResult[]): Promise<OverallFeedbackResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const assessed = results.filter((r) => r.score !== null);
  if (assessed.length === 0) return null;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(results) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return null;
    }

    const result = OverallFeedbackSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch (e) {
    console.error("Assignment overall feedback generation failed:", e);
    return null;
  }
}

function buildUserPrompt(results: PerQuestionResult[]): string {
  const lines = results
    .map((r) => {
      if (r.score === null) return `- Question ${r.questionNumber}: not yet assessed (pending instructor review)`;
      const pct = Math.round((r.score / r.maxScore) * 100);
      return `- Question ${r.questionNumber}: ${r.score}/${r.maxScore} (${pct}%). Strengths: ${r.strengths.join("; ") || "none noted"}. Areas for improvement: ${r.areasForImprovement.join("; ") || "none noted"}.`;
    })
    .join("\n");
  return `Per-question results:\n${lines}\n\nWrite the overall assignment summary.`;
}
