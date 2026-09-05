/**
 * M34 — AI screens every job posting for likely problems and surfaces
 * anything questionable, sorted for staff attention. The same
 * disagreement-gets-flagged pattern M21's extractQuestions.ts already
 * established for exam questions, deliberately mirrored rather than
 * invented fresh: fail closed into a flagged state on any uncertainty
 * or error, never silently pass a posting through unreviewed.
 *
 * Hard rule this file exists to enforce, same as M21's own: the AI
 * never approves a posting on its own authority. It only ever flags
 * or doesn't — every posting still needs a real staff decision
 * (see the decide route) before anyone sees it, regardless of what
 * this returns.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ScreeningResultSchema = z.object({
  concerning: z.boolean(),
  reason: z.string().nullable(),
});

export interface JobPostingScreeningResult {
  flagged: boolean;
  reason: string | null;
}

const SYSTEM_PROMPT = `You screen job postings submitted to a training platform's job board before a human reviews them.

Flag a posting ("concerning": true) if it shows signs of:
- Discriminatory requirements based on age, gender, religion, ethnicity, marital status, or disability, where not a genuine occupational requirement
- Classic job-scam patterns: any request for upfront payment, deposit, or fee from the applicant; "get rich quick" or unrealistic earnings promises; pyramid/MLM structure
- Content unrelated to a genuine job opening (spam, advertising, testing)
- Illegal activity

Do NOT flag a posting merely for being informal, brief, or for a role with modest pay — those are normal and not concerning on their own.

Respond with ONLY a JSON object: {"concerning": boolean, "reason": string or null}. If concerning is true, reason must be a short, specific explanation for a human reviewer. If false, reason must be null.`;

export async function screenJobPosting(title: string, description: string): Promise<JobPostingScreeningResult> {
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Title: ${title}\n\nDescription:\n${description}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return unresolvedFallback("AI returned no text content.");
    }

    let parsed: unknown;
    try {
      const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return unresolvedFallback("AI response was not valid JSON.");
    }

    const result = ScreeningResultSchema.safeParse(parsed);
    if (!result.success) {
      return unresolvedFallback("AI response did not match the expected schema.");
    }

    return { flagged: result.data.concerning, reason: result.data.reason };
  } catch (e) {
    return unresolvedFallback(`AI request failed: ${e instanceof Error ? e.message : "unknown error"}`);
  }
}

function unresolvedFallback(reason: string): JobPostingScreeningResult {
  // Could not screen this posting automatically — surface it as
  // flagged rather than silently letting it through unreviewed, the
  // same fail-closed reasoning as M21's own unresolvedFallback.
  return { flagged: true, reason };
}
