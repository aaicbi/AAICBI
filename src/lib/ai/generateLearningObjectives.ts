/**
 * Loop Question Bank — the first AI step in the pipeline: turning a
 * module's lesson materials into a draft list of learning objectives,
 * the primary assessment framework every generated question is later
 * grounded in. Same "AI never invents an answer with confidence it
 * doesn't have" discipline as extractQuestions.ts/generateCourseExam.ts
 * — every objective must be grounded in content actually present in
 * the material, never invented from the module's title alone.
 *
 * This is the one call in this feature that's genuinely cheap and
 * infrequent (once per module, not once per question), so it isn't
 * part of the batching/caching cost design the generation and
 * validation steps need — a single `claude-sonnet-4-5` call is fine.
 *
 * A `ModuleLearningObjective` row is only ever created by a human's
 * explicit confirm click (src/app/api/admin/loop/objectives/confirm/
 * route.ts) — this function only ever DRAFTS, never writes to the
 * database itself.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// A generous but bounded cap per material — keeps the prompt (and its
// cost) predictable even if a lesson's Word document is unusually
// long, rather than feeding an unbounded amount of text into one call.
const MAX_CHARS_PER_MATERIAL = 12_000;

const DraftObjectivesSchema = z.object({
  // Whether the material already stated its own objectives explicitly
  // (a "Learning Objectives"/"By the end of this module..." section)
  // versus these being AI-proposed from the content itself — shown to
  // the admin on the confirmation card, per the spec's own requirement
  // that AI-proposed objectives be clearly labeled as such. Not
  // persisted on ModuleLearningObjective itself: by the time a human
  // confirms either kind, both are equally real, approved content.
  foundExplicitObjectives: z.boolean(),
  objectives: z.array(z.string().trim().min(1)).min(1).max(12),
});

export interface DraftObjectivesResult {
  foundExplicitObjectives: boolean;
  objectives: string[];
}

export interface MaterialTextInput {
  title: string;
  text: string;
}

const SYSTEM_PROMPT = `You analyze a training module's lesson materials to identify its learning objectives — the primary assessment framework every exam question for this module will later be grounded in.

Look first for objectives already explicitly stated in the material — sections like "Learning Objectives", "Learning Outcomes", "Module Outcomes", "Course Outcomes", "At the end of this lesson, you should be able to...", "By the end of this module, learners should be able to...", or "What you will learn". If you find them, use them essentially as written (light cleanup of wording only), and set foundExplicitObjectives to true.

If no such section exists, analyze the material's actual content and propose 4-8 objectives reflecting what a learner should genuinely be able to do after studying it. Set foundExplicitObjectives to false in this case.

Rules:
- Every objective should describe something a learner can DO or DEMONSTRATE (apply a technique, identify a problem, choose the right approach) rather than just "know about X", wherever the material actually supports that level.
- Ground every objective in content genuinely present in the material below. Never invent a topic the material doesn't cover, and never generate an objective from the module's title alone.
- Respond with ONLY a JSON object of the shape {"foundExplicitObjectives": true or false, "objectives": ["...", "..."]}. No preamble, no markdown fences.`;

export async function draftLearningObjectives(moduleTitle: string, materials: MaterialTextInput[]): Promise<DraftObjectivesResult> {
  const materialsBlock = materials
    .map((m) => `--- ${m.title} ---\n${m.text.slice(0, MAX_CHARS_PER_MATERIAL)}`)
    .join("\n\n");
  const userPrompt = `Module: ${moduleTitle}\n\nMaterials:\n${materialsBlock}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Loop couldn't draft objectives — the AI response had no usable text.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text.replace(/```json|```/g, "").trim());
  } catch {
    throw new Error("Loop couldn't draft objectives — the AI response wasn't valid JSON.");
  }

  const result = DraftObjectivesSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Loop couldn't draft objectives — the AI response didn't match the expected shape.");
  }
  return result.data;
}
