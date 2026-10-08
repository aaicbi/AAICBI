import { prisma } from "@/lib/prisma";
import { extractQuestionsBatch } from "@/lib/ai/extractQuestions";
import { embeddingsEnabled, findDuplicatesForBatch, saveQuestionEmbedding } from "@/lib/embeddings";
import type { RawQuestionBlock } from "@/lib/parsing/docxParser";

export interface QuestionImportResult {
  questionsDetected: number;
  validQuestions: number;
  questionsRequiringReview: number;
  duplicatesFound: number;
  duplicateCheckSkipped: boolean;
  questions: unknown[];
}

/**
 * Structures the question blocks with AI, checks them against the exam's
 * existing questions for duplicates, and saves them all in one transaction
 * (so a failure leaves nothing half-imported). Never publishes: anything
 * uncertain or duplicated is flagged for review. Slow network work happens
 * before the transaction opens, as the module assessment import always did.
 */
export async function importQuestionsIntoExam(examId: string, blocks: RawQuestionBlock[]): Promise<QuestionImportResult> {
  const extracted = await extractQuestionsBatch(blocks);
  const duplicateCheckSkipped = !embeddingsEnabled();
  const { embeddings, matches } = await findDuplicatesForBatch(
    examId,
    extracted.map((item) => ({ questionText: item.structured.question, optionTexts: item.structured.options })),
  );

  const existingCount = await prisma.question.count({ where: { examId } });
  let duplicatesFound = 0;

  const created = await prisma.$transaction(
    async (tx: any) => {
      const results = [];
      for (let idx = 0; idx < extracted.length; idx++) {
        const item = extracted[idx];
        const dup = matches[idx];
        let needsReview = item.needsReview;
        let reviewReason = item.reviewReason;
        if (dup) {
          duplicatesFound++;
          needsReview = true;
          reviewReason = `Possible duplicate (${Math.round(dup.similarity * 100)}% similar) of an existing question: "${dup.matchedQuestionText.slice(0, 120)}"`;
        }
        const question = await tx.question.create({
          data: {
            examId,
            text: item.structured.question,
            topic: item.structured.topic,
            difficulty: (item.structured.difficulty?.toUpperCase() as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | undefined) ?? "BEGINNER",
            explanation: item.structured.explanation,
            order: existingCount + idx,
            needsReview,
            reviewReason,
            options: {
              create: item.structured.options.map((optText: string, optIdx: number) => ({
                text: optText,
                key: String.fromCharCode(65 + optIdx),
                isCorrect: optIdx === item.structured.correct_option_index,
                order: optIdx,
              })),
            },
          },
          include: { options: true },
        });
        const embedding = embeddings[idx];
        if (embedding) await saveQuestionEmbedding(question.id, embedding, tx);
        results.push(question);
      }
      return results;
    },
    { timeout: 100_000, maxWait: 10_000 },
  );

  const validCount = created.filter((q: { needsReview: boolean }) => !q.needsReview).length;
  return {
    questionsDetected: created.length,
    validQuestions: validCount,
    questionsRequiringReview: created.length - validCount,
    duplicatesFound,
    duplicateCheckSkipped,
    questions: created,
  };
}
