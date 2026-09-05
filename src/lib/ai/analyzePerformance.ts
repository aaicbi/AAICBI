/**
 * M13 — the second (and only other) place this project talks to an AI
 * provider, following the same house rule extractQuestions.ts states
 * for itself: this is the ONE file that calls the AI for performance
 * analysis, so a provider swap only touches this file.
 *
 * Hard rule this file exists to enforce, same spirit as
 * extractQuestions.ts's "never invent an answer": the model gets ONLY
 * the aggregated topic-level numbers computed by performanceCore.ts —
 * never the trainee's name, never the actual questions or answer
 * text, never anything it could use to invent a fact not present in
 * the numbers. Grounding the whole prompt in real, already-computed
 * statistics is what makes this "genuinely low risk," per the
 * roadmap's own sizing — there's nothing here for the model to
 * hallucinate FROM.
 *
 * M13 audit finding: `topic` strings ARE staff-authored free text
 * (instructor-typed at question creation, or AI-classified from an
 * instructor's own document at import time) — this file interpolates
 * them directly into the prompt with no escaping, the same trust
 * boundary extractQuestions.ts already accepts for raw question-block
 * text. Not a new category of risk this project hasn't already taken
 * on: the actor who can set a topic label is already a trusted staff
 * account, not trainee- or public-controlled input. What bounds the
 * blast radius even if a topic label tried to act as an instruction:
 * the output is validated against SummarySchema below, and anything
 * that doesn't parse into exactly {strengths, weaknesses, narrative}
 * is discarded — an injected instruction can influence what ends up
 * in those three fields, nothing more, no code path treats the
 * response as anything but that fixed shape.
 *
 * M13 audit finding: this used to reach for the same model
 * extractQuestions.ts uses (claude-sonnet-4-5) without reconsidering
 * whether it fits — that file's task (structuring raw, messy exam
 * content) is rare, admin-initiated, and genuinely needs a stronger
 * model; this one runs on every trainee submission and does a much
 * simpler job (turn pre-aggregated numbers into 2-3 sentences).
 * claude-haiku-4-5 is the deliberate choice now — cheaper, faster
 * (directly reduces the submit-request latency documented on the
 * PerformanceSummary schema comment), and there's no evidence a
 * lighter model is insufficient for a task this structurally
 * constrained. Revisit if real output quality says otherwise.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { TopicStat } from "@/lib/performanceCore";

// Same 15-second ceiling reasoning as the rest of this call: this runs
// inside a trainee's submit request (see the schema comment on
// PerformanceSummary for the full cost/latency tradeoff) — a hung
// request here must not be allowed to consume the whole serverless
// function's execution budget. Treated as a failure like any other on
// timeout, per generatePerformanceSummary's contract below.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 15_000 });

const SummarySchema = z.object({
  strengths: z.array(z.string()).max(5),
  weaknesses: z.array(z.string()).max(5),
  narrative: z.string().min(1),
});
export type PerformanceSummaryResult = z.infer<typeof SummarySchema>;

const SYSTEM_PROMPT = `You write a short, honest performance summary for a trainee who just completed an assessment, based ONLY on the topic-level statistics you're given. You have no other information about this trainee or assessment — never invent a topic, a number, or a fact that isn't in the data provided.

Each topic's data includes how many questions in it were never answered at all (out of time, skipped), separate from how many were answered incorrectly. These mean different things and deserve different confidence:
- Genuinely wrong answers are real evidence of a gap in that topic.
- Unanswered questions are NOT evidence the trainee doesn't know the material — only that they didn't get to it. A topic with many unanswered questions should never be called a confident "weakness"; if you mention it at all, say something like "didn't get to finish" or "ran out of time on," not "struggles with" or "needs to improve."

Rules:
- A topic needs at least 2 answered questions (attempted, not just assigned) to say anything confident about it. If a topic has fewer than 2 answered questions, leave it out of "strengths" and "weaknesses" — that's too small a sample either way.
- "strengths": topic names where the trainee scored well on the questions they actually answered (roughly 80% or higher of answered questions, with at least 2 answered).
- "weaknesses": topic names where the trainee got questions wrong that they actually attempted (below 60% of answered questions correct, with at least 2 answered) — never a topic whose low score comes mainly from unanswered questions.
- A topic that doesn't clearly fall into either bucket (a middling score, too few answered questions, or a low score that's mostly unanswered rather than wrong) just doesn't appear in either list — don't force every topic into strengths or weaknesses.
- "narrative": 2-3 sentences, plain and encouraging, naming the strongest and weakest areas if there are any worth naming, plus one concrete, actionable suggestion. If a topic was mostly unanswered rather than wrong, it's fine to mention running out of time as a suggestion (e.g. pacing) rather than a knowledge gap. If there isn't enough data to say anything meaningful, say that honestly and briefly instead of forcing a narrative that isn't really there.
- Respond with ONLY the JSON object. No preamble, no markdown fences.`;

/**
 * Generates a strengths/weaknesses/narrative summary from topic-level
 * stats. Returns null on ANY failure — no API key configured, the
 * request fails or times out, the response doesn't parse — never
 * throws. See the schema comment on PerformanceSummary for what a
 * null result means downstream (no row is written; the attempt's real
 * grading already happened and is unaffected).
 */
export async function generatePerformanceSummary(
  topicStats: TopicStat[],
  overallPercentage: number,
  passed: boolean
): Promise<PerformanceSummaryResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY is not set — skipping performance summary generation.");
    return null;
  }
  if (topicStats.length === 0) return null; // nothing to analyze — e.g. an attempt with zero assigned questions

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(topicStats, overallPercentage, passed) }],
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

    const result = SummarySchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch (e) {
    console.error("Performance summary generation failed:", e);
    return null;
  }
}

function buildUserPrompt(topicStats: TopicStat[], overallPercentage: number, passed: boolean): string {
  const lines = topicStats
    .map((t) => `- ${t.topic}: ${t.correct}/${t.total} correct (${t.unanswered} of those ${t.total} were never answered)`)
    .join("\n");
  return `Overall result: ${Math.round(overallPercentage)}% (${passed ? "passed" : "did not pass"}).

Topic-level breakdown:
${lines}

Write the performance summary.`;
}
