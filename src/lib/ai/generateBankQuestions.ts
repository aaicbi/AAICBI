/**
 * Loop Question Bank — Phase 3: grounded question generation. Modeled
 * directly on generateCourseExam.ts's two-call structure (generate,
 * then a separate BLIND verification call), extended with two real
 * differences: generation is grounded in a confirmed learning
 * objective's text plus the module's actual extracted lesson material
 * (not a source question to paraphrase), and both the generation and
 * verification calls process a BATCH of questions per call rather than
 * one call per question — the single biggest cost lever for this
 * feature (see the plan's own cost-cutting section).
 *
 * A deliberate, disclosed adjustment made during implementation:
 * Anthropic prompt caching (the plan's other planned cost lever) turns
 * out to only be exposed by the installed SDK version
 * (@anthropic-ai/sdk 0.32.1) through its beta namespace
 * (client.beta.messages / client.beta.promptCaching.messages), which
 * returns a different response type (BetaMessage) than every other AI
 * call site in this codebase uses (confirmed by reading the SDK's own
 * type definitions before writing this). Rather than introduce that
 * inconsistency and a dependency on a beta surface for one feature,
 * this ships with batching + model tiering only — still a real
 * ~5-10x reduction from the naive per-question estimate, just not the
 * full ~10-20x the plan estimated assuming caching too. Caching
 * remains available as a real future addition once this reaches the
 * standard endpoint, or the SDK is upgraded.
 *
 * Every row this creates has needsReview: true and bankStatus:
 * "PENDING_REVIEW" — structurally invisible to any trainee attempt
 * (see src/lib/examEngine.ts's own needsReview filter, which applies
 * regardless of Exam.published) until a human clears it at gate 1, the
 * same trust level as a fresh DOCX-import or course-exam-paraphrase
 * row, both already written directly today.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getModuleMaterialsText, type UsableMaterialText } from "@/lib/parsing/moduleMaterialsText";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Questions per Claude call — the batching lever: amortizes the
// repeated material-text input across this many questions instead of
// paying it fresh per question.
const GENERATION_SUB_BATCH_SIZE = 10;
// Max questions generated per single function invocation (one HTTP
// request) — same bounded-batch discipline as generateCourseExam.ts's
// GENERATION_BATCH_SIZE, sized to stay well inside a serverless
// function's execution timeout.
const BANK_GENERATION_BATCH_SIZE = 20;
// A bound on the combined material text fed into every call — keeps
// cost and prompt size predictable even for a module with several
// substantial lesson documents.
const MAX_MATERIAL_CHARS_TOTAL = 40_000;

// Same code-generation helper as the other Exam-creating routes,
// duplicated locally on purpose — see generateCourseExam.ts's own
// comment on why this small a helper isn't worth importing across
// files.
function makeExamCode(title: string): string {
  const slug = title
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug}-${suffix}`;
}

const GeneratedQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(6),
  correct_option_index: z.number().int().min(0).max(5),
  explanation: z.string().nullable(),
  topic: z.string().nullable(),
});
const GeneratedBatchSchema = z.object({ questions: z.array(GeneratedQuestionSchema).min(1) });

const VerificationBatchSchema = z.object({
  verifications: z.array(z.object({ index: z.number().int(), correct_option_index: z.number().int() })),
});

const GENERATION_SYSTEM_PROMPT = `You write scenario-based multiple-choice exam questions for a training module, grounded strictly in the lesson material provided.

Rules:
- Every question must test the given learning objective — not just recall a fact from the material, but assess whether a learner has achieved that objective (apply a technique, identify a problem, choose the right approach), wherever the objective calls for that level of understanding.
- Ground every question in the material provided. Never invent a fact, number, or process the material doesn't actually contain, and never generate a question from the objective's wording alone without real support in the material.
- Prefer a realistic scenario (a workplace situation, a technical problem, a practical case) over an abstract, out-of-context question, where that fits the objective.
- Exactly one option must be correct. Distractors must be plausible but clearly wrong on reflection — never trivially silly, never accidentally also defensible.
- Vary which option (0, 1, 2, or 3) is correct across the questions in this batch — do not always put the correct answer in the same position.
- Each question must be genuinely distinct from the others in this batch — do not repeat the same underlying concept with only the wording changed.
- Respond with ONLY a JSON object of the shape {"questions": [{"question": "...", "options": ["...", "...", "...", "..."], "correct_option_index": 0, "explanation": "..." or null, "topic": "..." or null}, ...]}. No preamble, no markdown fences.`;

const VERIFICATION_SYSTEM_PROMPT = `You are given a set of exam questions and their options, with no indication of which option was marked correct for any of them, plus the lesson material they are supposed to be grounded in. For EACH question, work out the correct answer yourself, from the material, independently — do not assume any option is correct just because of its position or wording.

Respond with ONLY a JSON object of the shape {"verifications": [{"index": 0, "correct_option_index": 0}, ...]}, one entry per question, in the same order they were given. No preamble, no markdown fences.`;

interface GeneratedResult {
  text: string;
  options: { text: string; isCorrect: boolean }[];
  explanation: string | null;
  topic: string | null;
  reviewReason: string;
  disagreement: boolean;
}

function buildMaterialsBlock(materials: UsableMaterialText[]): string {
  return materials.map((m) => `--- ${m.title} ---\n${m.text}`).join("\n\n").slice(0, MAX_MATERIAL_CHARS_TOTAL);
}

function stripFences(text: string): string {
  return text.replace(/```json|```/g, "").trim();
}

async function generateSubBatch(materialsBlock: string, objectiveText: string, count: number): Promise<GeneratedResult[]> {
  const genUserPrompt = `Learning objective:\n${objectiveText}\n\nLesson material:\n${materialsBlock}\n\nWrite ${count} distinct, non-overlapping questions testing this objective.`;

  const genResponse = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4000,
    system: GENERATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: genUserPrompt }],
  });
  const genText = genResponse.content.find((b) => b.type === "text");
  if (!genText || genText.type !== "text") return [];

  let genParsed: unknown;
  try {
    genParsed = JSON.parse(stripFences(genText.text));
  } catch {
    return [];
  }
  const generated = GeneratedBatchSchema.safeParse(genParsed);
  if (!generated.success) return [];

  // The batch-wide blind verification call — same "independent, never
  // told the generator's own answer" discipline as
  // generateCourseExam.ts's single-question version, extended to a
  // whole batch at once (the actual cost lever) and re-grounded in the
  // same source material — a deeper check than that file's version,
  // which only ever sees question+options.
  const verifyUserPrompt = `Lesson material:\n${materialsBlock}\n\nQuestions:\n${generated.data.questions
    .map((q, i) => `${i}) ${q.question}\nOptions:\n${q.options.map((o, oi) => `  ${oi}) ${o}`).join("\n")}`)
    .join("\n\n")}`;

  let verifications: Map<number, number> | null = null;
  try {
    const verifyResponse = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: VERIFICATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: verifyUserPrompt }],
    });
    const verifyText = verifyResponse.content.find((b) => b.type === "text");
    if (verifyText && verifyText.type === "text") {
      const verifyParsed = JSON.parse(stripFences(verifyText.text));
      const verified = VerificationBatchSchema.safeParse(verifyParsed);
      if (verified.success) {
        verifications = new Map(verified.data.verifications.map((v) => [v.index, v.correct_option_index]));
      }
    }
  } catch {
    // A failed verification call is treated as a disagreement for
    // every question in this sub-batch, not a pass — same fail-safe
    // discipline as generateCourseExam.ts. `verifications` stays null,
    // which the map below reads as "no verified index" for every item.
  }

  return generated.data.questions.map((q, i) => {
    const verifiedIndex = verifications?.get(i);
    const disagreement = verifiedIndex === undefined || verifiedIndex !== q.correct_option_index;
    return {
      text: q.question,
      options: q.options.map((text, oi) => ({ text, isCorrect: oi === q.correct_option_index })),
      explanation: q.explanation,
      topic: q.topic,
      disagreement,
      reviewReason: disagreement
        ? "Self-consistency check disagreed with the generated answer — verify carefully before approving."
        : "AI-generated for the question bank — pending staff review.",
    };
  });
}

/**
 * The full Loop-triggered action. Generates up to `requestedCount`
 * questions (capped at BANK_GENERATION_BATCH_SIZE per call — the same
 * "generate N of M, continue?" caller contract as
 * generateCourseExamination) for one confirmed learning objective,
 * grounded in the module's usable (DOCX) materials. Safe to call again
 * later for the same objective to top up the bank further.
 */
export async function generateBankQuestionBatch(
  moduleId: string,
  objectiveId: string,
  staffUserId: string,
  requestedCount: number
): Promise<{ generated: number; failed: number; remaining: number }> {
  const objective = await prisma.moduleLearningObjective.findFirst({
    where: { id: objectiveId, moduleId },
    select: { id: true, text: true },
  });
  if (!objective) {
    throw new Error("That learning objective could not be found for this module.");
  }

  const materials = await getModuleMaterialsText(moduleId);
  if (materials.usable.length === 0) {
    throw new Error("No usable materials found for this module — only Word documents can be analyzed right now.");
  }
  const materialsBlock = buildMaterialsBlock(materials.usable);

  const targetModule = await prisma.module.findUniqueOrThrow({ where: { id: moduleId }, select: { title: true } });

  let exam = await prisma.exam.findUnique({ where: { moduleId } });
  if (!exam) {
    try {
      exam = await prisma.exam.create({
        data: {
          title: `${targetModule.title} — Assessment`,
          code: makeExamCode(`${targetModule.title} Assessment`),
          moduleId,
          createdById: staffUserId,
          published: false,
        },
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "P2002") throw e;
      // Same race the module-assessment route already guards against:
      // two near-simultaneous generation requests could both see no
      // existing exam. Unlike that route, this is a library function
      // whose job is getting questions generated, so the right
      // recovery is using whichever exam row actually won the race.
      exam = await prisma.exam.findUniqueOrThrow({ where: { moduleId } });
    }
  }

  const target = Math.min(requestedCount, BANK_GENERATION_BATCH_SIZE);
  let generatedCount = 0;
  let failedCount = 0;

  while (generatedCount + failedCount < target) {
    const thisSubBatchSize = Math.min(GENERATION_SUB_BATCH_SIZE, target - generatedCount - failedCount);
    let results: GeneratedResult[];
    try {
      results = await generateSubBatch(materialsBlock, objective.text, thisSubBatchSize);
    } catch (e) {
      console.error("Loop bank question sub-batch failed:", e);
      results = [];
    }
    if (results.length === 0) {
      failedCount += thisSubBatchSize;
      break; // a persistently failing call shouldn't loop forever within one request
    }

    for (const result of results) {
      const question = await prisma.question.create({
        data: {
          examId: exam.id,
          text: result.text,
          topic: result.topic,
          explanation: result.explanation,
          needsReview: true,
          reviewReason: result.reviewReason,
          bankStatus: "PENDING_REVIEW",
          bankObjectiveId: objective.id,
          options: {
            create: result.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, key: String.fromCharCode(65 + i) })),
          },
          sourceMaterials: { create: materials.usable.map((m) => ({ materialId: m.materialId })) },
        },
      });
      await prisma.questionBankEvent.create({
        data: {
          questionId: question.id,
          fromStatus: null,
          toStatus: "PENDING_REVIEW",
          kind: result.disagreement ? "SELF_CHECK_DISAGREED" : "GENERATED",
          note: result.reviewReason,
          actedById: null,
        },
      });
      generatedCount++;
    }
    failedCount += thisSubBatchSize - results.length;
  }

  return { generated: generatedCount, failed: failedCount, remaining: Math.max(0, requestedCount - generatedCount) };
}
