/**
 * AI Assignment Engine, Phase 2 — cross-assignment learning insights
 * (§20). Structured exactly like analyzePerformance.ts: claude-haiku-4-5
 * (synthesizing already-computed numbers, not a judgment call that
 * needs the stronger model assessAssignmentAnswer.ts uses), same
 * fence-strip + JSON.parse + Zod safeParse pattern, returns null on any
 * failure rather than throwing.
 *
 * Same anti-hallucination grounding boundary analyzePerformance.ts's
 * own comment describes for its own input: the model is fed ONLY
 * pre-aggregated per-learningObjective score stats — never a trainee's
 * name, never the actual question or answer text. Nothing here for the
 * model to hallucinate FROM.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 15_000 });

const InsightSchema = z.object({
  strengths: z.array(z.string()).max(5),
  weaknesses: z.array(z.string()).max(5),
  narrative: z.string().min(1),
});
export type LearningInsightResult = z.infer<typeof InsightSchema>;

export interface LearningObjectiveStat {
  learningObjective: string; // "General" when a question had none set
  totalPercentage: number; // sum of per-answer percentages, for averaging
  count: number;
}

const SYSTEM_PROMPT = `You write a short, honest cross-assignment learning summary for a student, based ONLY on the per-topic average scores you're given across every assignment they've completed. You have no other information — never invent a topic, a number, or a fact not in the data provided.

Return exactly this JSON shape:
{
  "strengths": string[],
  "weaknesses": string[],
  "narrative": string
}

Rules:
- A topic needs at least 2 scored questions to say anything confident about it — if a topic has fewer, leave it out of both lists.
- "strengths": topics averaging 80% or higher.
- "weaknesses": topics averaging below 60%.
- A topic in between, or with too few data points, simply doesn't appear in either list.
- "narrative": 2-3 sentences, plain and encouraging, naming the strongest and weakest topics if there are any worth naming, plus one concrete, actionable suggestion for what to practice next. If there isn't enough data to say anything meaningful yet, say that honestly and briefly.
- Respond with ONLY the JSON object. No preamble, no markdown fences.`;

/** Returns null on any failure — a missing insight never blocks or
 * degrades anything else; the trainee's real, required assignment
 * score and feedback are already committed by the time this runs. */
export async function analyzeAssignmentLearningPatterns(stats: LearningObjectiveStat[]): Promise<LearningInsightResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (stats.length === 0) return null;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(stats) }],
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

    const result = InsightSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch (e) {
    console.error("Assignment learning pattern analysis failed:", e);
    return null;
  }
}

function buildUserPrompt(stats: LearningObjectiveStat[]): string {
  const lines = stats
    .map((s) => `- ${s.learningObjective}: average ${Math.round(s.totalPercentage / s.count)}% across ${s.count} scored question${s.count === 1 ? "" : "s"}`)
    .join("\n");
  return `Per-topic averages across all completed assignments:\n${lines}\n\nWrite the cross-assignment learning summary.`;
}
