/**
 * Loop Question Bank — Phase 4: independent validation. A SEPARATE,
 * deeper AI pass than Phase 3's own generation-time self-check — this
 * one runs only after a human has already cleared a question at gate
 * 1, re-grounds against the same source material for a full-strength
 * blind correctness check, and adds two checks generation's own
 * self-check never performs at all: objective alignment and
 * ambiguity. A third, non-AI check (near-duplicate detection) reuses
 * this codebase's existing embeddings pipeline exactly as-is.
 *
 * Same disclosed adjustment as generateBankQuestions.ts: batching (up
 * to 10 questions per Claude call) and model tiering (cheaper
 * claude-haiku-4-5 for the two lower-stakes checks, claude-sonnet-4-5
 * reserved for the correctness re-derivation) — not prompt caching,
 * which the installed SDK only exposes through a beta response type
 * this codebase doesn't otherwise use. See that file's own comment for
 * the full reasoning.
 *
 * A VALIDATED_PASS question is auto-promoted to APPROVED in the same
 * pass, per the user's own confirmed scoping decision — a clean
 * independent pass needs no second human click. Everything else is
 * left for the gate 2 review screen, with the full structured verdict
 * stored on a QuestionBankEvent row so that screen shows exactly what
 * the validator found, not just a one-line reason.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { QuestionBankStatus } from "@prisma/client";
import { getModuleMaterialsText } from "@/lib/parsing/moduleMaterialsText";
import { findDuplicatesForBatch, saveQuestionEmbedding, embeddingsEnabled } from "@/lib/embeddings";
import { isDuplicateMatch } from "@/lib/embeddingsCore";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALIDATION_SUB_BATCH_SIZE = 10;
const VALIDATION_BATCH_SIZE = 20;
const MAX_MATERIAL_CHARS_TOTAL = 40_000;

function stripFences(text: string): string {
  return text.replace(/```json|```/g, "").trim();
}

const CorrectnessSchema = z.object({
  verifications: z.array(z.object({ index: z.number().int(), correct_option_index: z.number().int() })),
});

const CORRECTNESS_SYSTEM_PROMPT = `You are given a set of exam questions and their options, with no indication of which option was marked correct for any of them, plus the lesson material they are supposed to be grounded in. For EACH question, independently determine the correct answer from the material alone — do not assume any option is correct because of its position or wording.

Respond with ONLY a JSON object of the shape {"verifications": [{"index": 0, "correct_option_index": 0}, ...]}, one entry per question, in the same order given. No preamble, no markdown fences.`;

const AlignmentAmbiguitySchema = z.object({
  results: z.array(
    z.object({
      index: z.number().int(),
      aligned: z.boolean(),
      alignmentReason: z.string().nullable(),
      ambiguous: z.boolean(),
      ambiguityReason: z.string().nullable(),
    })
  ),
});

const ALIGNMENT_SYSTEM_PROMPT = `You are reviewing exam questions for quality. For EACH question, given its intended learning objective, judge two things:
1. "aligned": does the question actually test whether the learner has achieved that objective — not merely recall of an unrelated fact from the same topic? A question that only tests memorization when the objective calls for application should be marked NOT aligned.
2. "ambiguous": could more than one of the given options reasonably be defended as correct, or is the question's wording genuinely unclear about what it's asking?

Respond with ONLY a JSON object of the shape {"results": [{"index": 0, "aligned": true, "alignmentReason": null, "ambiguous": false, "ambiguityReason": null}, ...]}, one entry per question, in the same order given. Set a reason string only when the corresponding flag is a concern (aligned: false or ambiguous: true); otherwise null. No preamble, no markdown fences.`;

/**
 * The pure decision this whole check exists to make — Prisma-free and
 * independently unit-testable. Correctness disagreement is the most
 * severe outcome (the generator's own answer key may be wrong);
 * objective misalignment or ambiguity is a real content-quality
 * problem needing human judgment; a duplicate alone is the softest
 * concern, worth a human glance but not a sign of possibly-incorrect
 * content.
 */
export function combineValidationSignals(
  correctnessAgrees: boolean,
  objectiveAligned: boolean,
  ambiguous: boolean,
  isDuplicate: boolean
): QuestionBankStatus {
  if (!correctnessAgrees) return "VALIDATED_REJECTED";
  if (!objectiveAligned || ambiguous) return "VALIDATED_FLAGGED";
  if (isDuplicate) return "VALIDATED_WARNING";
  return "VALIDATED_PASS";
}

interface PendingQuestion {
  id: string;
  text: string;
  options: { text: string; isCorrect: boolean }[];
  objectiveText: string;
}

async function runCorrectnessCheck(materialsBlock: string, questions: PendingQuestion[]): Promise<Map<number, number>> {
  const userPrompt = `Lesson material:\n${materialsBlock}\n\nQuestions:\n${questions
    .map((q, i) => `${i}) ${q.text}\nOptions:\n${q.options.map((o, oi) => `  ${oi}) ${o.text}`).join("\n")}`)
    .join("\n\n")}`;
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: CORRECTNESS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return new Map();
    const parsed = CorrectnessSchema.safeParse(JSON.parse(stripFences(textBlock.text)));
    if (!parsed.success) return new Map();
    return new Map(parsed.data.verifications.map((v) => [v.index, v.correct_option_index]));
  } catch {
    // Empty map reads as "no verified index" below — treated as a
    // disagreement, the same fail-safe discipline as generation's own
    // self-check.
    return new Map();
  }
}

interface AlignmentResult {
  aligned: boolean;
  alignmentReason: string | null;
  ambiguous: boolean;
  ambiguityReason: string | null;
}

async function runAlignmentCheck(questions: PendingQuestion[]): Promise<Map<number, AlignmentResult>> {
  const userPrompt = questions
    .map(
      (q, i) =>
        `${i}) Objective: ${q.objectiveText}\nQuestion: ${q.text}\nOptions:\n${q.options.map((o, oi) => `  ${oi}) ${o.text}`).join("\n")}`
    )
    .join("\n\n");
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      system: ALIGNMENT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return new Map();
    const parsed = AlignmentAmbiguitySchema.safeParse(JSON.parse(stripFences(textBlock.text)));
    if (!parsed.success) return new Map();
    return new Map(parsed.data.results.map((r) => [r.index, r]));
  } catch {
    // Empty map below fails safe toward "needs a human look" — see the
    // orchestrator's own fallback reasoning.
    return new Map();
  }
}

const EVENT_KIND_BY_STATUS: Record<string, string> = {
  VALIDATED_REJECTED: "INDEPENDENT_VALIDATION_REJECTED",
  VALIDATED_FLAGGED: "INDEPENDENT_VALIDATION_FLAGGED",
  VALIDATED_WARNING: "INDEPENDENT_VALIDATION_WARNING",
};

const REVIEW_REASON_BY_STATUS: Record<string, string> = {
  VALIDATED_REJECTED: "Independent validation disagreed with the answer — needs a second review.",
  VALIDATED_FLAGGED: "Independent validation flagged an objective-alignment or ambiguity concern — needs a second review.",
  VALIDATED_WARNING: "Independent validation found a likely near-duplicate — needs a second review.",
};

/**
 * The full Loop-triggered (or plain-button-triggered) action. Pulls up
 * to `requestedCount` (capped at VALIDATION_BATCH_SIZE per call — same
 * "N of M, continue?" caller contract as generation) PENDING_VALIDATION
 * questions for a module, runs all three checks, and writes the
 * resulting status — auto-promoting a clean pass straight to APPROVED.
 */
export async function validateBankQuestionBatch(
  moduleId: string,
  requestedCount: number
): Promise<{ validated: number; passed: number; needsReview: number; remaining: number }> {
  const exam = await prisma.exam.findUnique({ where: { moduleId }, select: { id: true } });
  if (!exam) {
    return { validated: 0, passed: 0, needsReview: 0, remaining: 0 };
  }

  const pending = await prisma.question.findMany({
    where: { examId: exam.id, bankStatus: "PENDING_VALIDATION" },
    select: {
      id: true,
      text: true,
      options: { select: { text: true, isCorrect: true }, orderBy: { key: "asc" } },
      bankObjective: { select: { text: true } },
    },
    orderBy: { createdAt: "asc" },
    take: Math.min(requestedCount, VALIDATION_BATCH_SIZE),
  });

  if (pending.length === 0) {
    return { validated: 0, passed: 0, needsReview: 0, remaining: 0 };
  }

  const materials = await getModuleMaterialsText(moduleId);
  const materialsBlock = materials.usable
    .map((m) => `--- ${m.title} ---\n${m.text}`)
    .join("\n\n")
    .slice(0, MAX_MATERIAL_CHARS_TOTAL);

  let passedCount = 0;
  let flaggedCount = 0;

  for (let i = 0; i < pending.length; i += VALIDATION_SUB_BATCH_SIZE) {
    const subBatch = pending.slice(i, i + VALIDATION_SUB_BATCH_SIZE).map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options,
      objectiveText: q.bankObjective?.text ?? "(no objective recorded for this question)",
    }));

    const [correctness, alignment, duplicates] = await Promise.all([
      runCorrectnessCheck(materialsBlock, subBatch),
      runAlignmentCheck(subBatch),
      findDuplicatesForBatch(
        exam.id,
        subBatch.map((q) => ({ questionText: q.text, optionTexts: q.options.map((o) => o.text) }))
      ),
    ]);

    for (let j = 0; j < subBatch.length; j++) {
      const q = subBatch[j];
      const originalCorrectIndex = q.options.findIndex((o) => o.isCorrect);
      const verifiedIndex = correctness.get(j);
      const correctnessAgrees = verifiedIndex !== undefined && verifiedIndex === originalCorrectIndex;

      const alignmentResult = alignment.get(j);
      // Fail-safe, same discipline as every AI check in this feature:
      // no result at all reads as "needs a human look," never as a
      // silent pass.
      const aligned = alignmentResult?.aligned ?? false;
      const ambiguous = alignmentResult?.ambiguous ?? true;

      const duplicateMatch = duplicates.matches[j];
      const isDup = duplicateMatch !== null && isDuplicateMatch(duplicateMatch.similarity);

      const status = combineValidationSignals(correctnessAgrees, aligned, ambiguous, isDup);

      const embedding = duplicates.embeddings[j];
      if (embedding) {
        await saveQuestionEmbedding(q.id, embedding).catch((e) =>
          console.error(`Failed to save embedding for question ${q.id}:`, e)
        );
      }

      const detail = {
        correctness: { agrees: correctnessAgrees, verifiedOptionIndex: verifiedIndex ?? null, originalOptionIndex: originalCorrectIndex },
        alignment: { aligned, reason: alignmentResult?.alignmentReason ?? null },
        ambiguity: { ambiguous, reason: alignmentResult?.ambiguityReason ?? null },
        duplicate:
          isDup && duplicateMatch
            ? { matchedQuestionId: duplicateMatch.matchedQuestionId, matchedQuestionText: duplicateMatch.matchedQuestionText, similarity: duplicateMatch.similarity }
            : null,
        // Honest, not silently treated as "confirmed unique" — see
        // this file's own top comment.
        duplicateCheckSkipped: !embeddingsEnabled(),
      };

      if (status === "VALIDATED_PASS") {
        await prisma.question.update({
          where: { id: q.id },
          data: { bankStatus: "APPROVED", needsReview: false, reviewReason: null },
        });
        await prisma.questionBankEvent.createMany({
          data: [
            {
              questionId: q.id,
              fromStatus: "PENDING_VALIDATION",
              toStatus: "VALIDATED_PASS",
              kind: "INDEPENDENT_VALIDATION_PASS",
              detail,
              actedById: null,
            },
            { questionId: q.id, fromStatus: "VALIDATED_PASS", toStatus: "APPROVED", kind: "AUTO_APPROVED", actedById: null },
          ],
        });
        passedCount++;
      } else {
        await prisma.question.update({
          where: { id: q.id },
          data: { bankStatus: status, reviewReason: REVIEW_REASON_BY_STATUS[status] },
        });
        await prisma.questionBankEvent.create({
          data: {
            questionId: q.id,
            fromStatus: "PENDING_VALIDATION",
            toStatus: status,
            kind: EVENT_KIND_BY_STATUS[status] ?? "INDEPENDENT_VALIDATION_FLAGGED",
            detail,
            actedById: null,
          },
        });
        flaggedCount++;
      }
    }
  }

  return {
    validated: passedCount + flaggedCount,
    passed: passedCount,
    needsReview: flaggedCount,
    remaining: Math.max(0, requestedCount - (passedCount + flaggedCount)),
  };
}
