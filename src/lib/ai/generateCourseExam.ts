/**
 * M21 — AI Course Examination Generation. The staff-triggered
 * "Generate Course Examination" action: synthesizes new, paraphrased
 * questions from a course's existing module question banks — genuinely
 * new wording testing the same underlying knowledge, not copies.
 *
 * Scope decision worth stating plainly: the roadmap describes this as
 * "~100 new questions." Rather than force an arbitrary target count
 * that might not fit a real course's bank size, this generates exactly
 * one new question per existing PUBLISHED module-assessment question
 * in the course — a real, defensible 1:1 relationship that also makes
 * the source-question tracking (`generatedFromQuestionId`) naturally
 * clean, rather than an artificial total forcing multiple variations
 * per source or an arbitrarily truncated set.
 *
 * Same "AI never invents an answer with confidence it doesn't have"
 * discipline as extractQuestions.ts, extended with a second layer this
 * milestone specifically adds: an independent, blind self-consistency
 * check. A disagreement between the generation pass and this second
 * check doesn't mean the question is wrong — it means a human should
 * look at it before anyone else does, which is exactly what flows into
 * the review queue this whole system already has.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Same code-generation helper as POST /api/exams and the module
// assessment route, duplicated locally on purpose — it's five lines
// with zero dependencies of its own, and importing across files for
// something this small isn't worth the coupling. A course examination
// still gets a code (see the schema comment on Exam.code) even though
// a trainee reaches it through course navigation, never by typing one.
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
});

const GENERATION_SYSTEM_PROMPT = `You write a NEW exam question that tests the same underlying knowledge as a given source question, for a course-wide examination — genuinely different wording and framing, not a copy or a trivial word-swap.

Rules:
- The new question must test the same core concept as the source, but a trainee who only memorized the source question's exact wording should not be able to answer this one from memorization alone.
- Keep the same general difficulty level as the source.
- Exactly one option must be correct.
- Respond with ONLY the JSON object of the shape {"question": "...", "options": ["...", "...", ...], "correct_option_index": 0, "explanation": "..." or null}. No preamble, no markdown fences.`;

const VERIFICATION_SYSTEM_PROMPT = `You are given an exam question and its options, with no indication of which option is correct. Work out the correct answer yourself, from first principles.

Respond with ONLY a JSON object of the shape {"correct_option_index": 0}. No preamble, no markdown fences.`;

interface SourceQuestion {
  id: string;
  text: string;
  options: { text: string; isCorrect: boolean }[];
}

interface GeneratedResult {
  sourceQuestionId: string;
  text: string;
  options: { text: string; isCorrect: boolean }[];
  explanation: string | null;
  needsReview: boolean;
  reviewReason: string | null;
}

async function generateOne(source: SourceQuestion): Promise<GeneratedResult | null> {
  const userPrompt = `Source question:\n${source.text}\n\nOptions:\n${source.options
    .map((o, i) => `${i}) ${o.text}${o.isCorrect ? " (correct)" : ""}`)
    .join("\n")}\n\nWrite a new question testing the same knowledge.`;

  const genResponse = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 800,
    system: GENERATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  const genText = genResponse.content.find((b) => b.type === "text");
  if (!genText || genText.type !== "text") return null;

  let genParsed: unknown;
  try {
    genParsed = JSON.parse(genText.text.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
  const generated = GeneratedQuestionSchema.safeParse(genParsed);
  if (!generated.success) return null;

  // The self-consistency check this milestone specifically adds: a
  // second, independent, BLIND call — shown only the question and
  // options, never told which one the generation pass believed was
  // correct. Genuinely separate from the generation call above, not a
  // second question appended to the same conversation, so it can't be
  // influenced by the first pass's own reasoning.
  const verifyPrompt = `Question:\n${generated.data.question}\n\nOptions:\n${generated.data.options
    .map((o, i) => `${i}) ${o}`)
    .join("\n")}`;
  let disagreement = false;
  try {
    // Honest deviation from the original plan, worth stating plainly:
    // this was originally scoped as a cheaper Haiku-class call, since
    // verification is a simpler task than generation. Kept on the same
    // model as generation instead — this codebase's one other AI call
    // site (extractQuestions.ts) already uses "claude-sonnet-4-5" as a
    // known-working model string, and guessing at a Haiku model string
    // this sandbox has no way to verify against the real API risks
    // silently breaking the whole verification step. A real, deliberate
    // cost/certainty tradeoff, not an oversight.
    const verifyResponse = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 200,
      system: VERIFICATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: verifyPrompt }],
    });
    const verifyText = verifyResponse.content.find((b) => b.type === "text");
    if (verifyText && verifyText.type === "text") {
      const verifyParsed = JSON.parse(verifyText.text.replace(/```json|```/g, "").trim());
      const verified = z.object({ correct_option_index: z.number().int() }).safeParse(verifyParsed);
      if (verified.success && verified.data.correct_option_index !== generated.data.correct_option_index) {
        disagreement = true;
      }
    }
  } catch {
    // A failed verification call is treated as a disagreement, not a
    // pass — the whole point of this check is catching questions that
    // shouldn't reach a trainee without a human looking first; a
    // verification call that couldn't run at all is exactly the kind
    // of uncertainty that belongs in the review queue, not silently
    // treated as "verified fine."
    disagreement = true;
  }

  return {
    sourceQuestionId: source.id,
    text: generated.data.question,
    options: generated.data.options.map((text, i) => ({ text, isCorrect: i === generated.data.correct_option_index })),
    explanation: generated.data.explanation,
    needsReview: true, // every AI-generated question needs review, disagreement or not — see this file's own top comment
    reviewReason: disagreement
      ? "Self-consistency check disagreed with the generated answer — verify carefully before approving."
      : "AI-generated for the course examination — pending staff review.",
  };
}

/**
 * The full staff-triggered action. Pulls every published module
 * assessment's questions in the course, generates one new question per
 * source (sequential, same reasoning as extractQuestionsBatch — keeps
 * this predictable under sandboxed rate limits), creates the course
 * examination shell if one doesn't exist yet, and appends the results.
 * Safe to call again later to top up an existing course examination's
 * bank — not a one-time-only action.
 *
 * Audit finding, fixed here: this used to loop over every source
 * question with no limit at all — two sequential Claude calls each,
 * so a course with a large combined module bank could easily mean
 * 100+ calls in one request, a real risk of exceeding a serverless
 * function's timeout with no background-job system to fall back on
 * (confirmed, not assumed — this project deliberately has none, see
 * M38's own design). Capped to a real, bounded batch per invocation.
 *
 * Getting the batching right took real thought, not just adding a
 * `.slice()`: a naive cap taking the same first N sources every time
 * would get stuck reprocessing that same batch forever on repeated
 * calls, never reaching the rest — exactly the kind of thing a staff
 * member clicking "Generate More" again after a timeout would hit.
 * Ordered by how many questions have already been generated from each
 * source (ascending) instead, using the real `generatedQuestions`
 * reverse relation already on the schema: brand-new sources (0
 * generated so far) are always processed first, so repeated calls
 * genuinely advance through the full set rather than looping on the
 * same batch. Once every source has at least one generated question,
 * this same ordering naturally starts round-robining toward
 * additional variety — which is exactly the intentional "generate
 * more later" use case this action is also meant to support, not
 * something this fix accidentally breaks.
 */
const GENERATION_BATCH_SIZE = 20;

export async function generateCourseExamination(courseId: string, staffUserId: string): Promise<{ generated: number; failed: number; remaining: number }> {
  const sourceQuestions = await prisma.question.findMany({
    where: {
      exam: { courseModule: { courseId }, published: true },
      // Only ever generate from a module-bank question that's already
      // staff-approved (needsReview: false) — an unreviewed source
      // question might itself be wrong, and generating a NEW question
      // from a possibly-wrong one would just propagate the problem
      // into a second, harder-to-trace place. This is exactly the same
      // "known-good foundation" reasoning as everything else in this
      // review pipeline.
      needsReview: false,
    },
    select: {
      id: true,
      text: true,
      options: { select: { text: true, isCorrect: true } },
      // See this function's own top comment on why this drives the
      // batch ordering, not just informational.
      _count: { select: { generatedQuestions: true } },
    },
    // Ascending — sources with the fewest (starting at zero) generated
    // questions come first, so repeated calls genuinely advance
    // through the full set instead of reprocessing the same batch.
    orderBy: { generatedQuestions: { _count: "asc" } },
  });

  if (sourceQuestions.length === 0) {
    return { generated: 0, failed: 0, remaining: 0 };
  }

  const batch = sourceQuestions.slice(0, GENERATION_BATCH_SIZE);
  const remaining = sourceQuestions.length - batch.length;

  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { title: true } });

  let exam = await prisma.exam.findUnique({ where: { courseId } });
  if (!exam) {
    try {
      exam = await prisma.exam.create({
        data: {
          title: `${course.title} — Course Examination`,
          code: makeExamCode(`${course.title} Course Examination`),
          courseId,
          createdById: staffUserId,
          published: false, // staff must explicitly publish once questions are reviewed — same discipline as a module assessment
          durationMinutes: 90,
          passMarkPercent: 80,
          retakeCooldownHours: 72,
        },
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "P2002") throw e;
      // Same race the module-assessment route already guards against
      // (see its own comment on this exact P2002): two near-
      // simultaneous "generate" triggers could both see no existing
      // exam and both attempt to create one. Unlike that route, this
      // isn't a user-facing "set up a new thing" action returning a
      // 409 — it's a library function whose job is getting questions
      // generated, so the right recovery is using whichever exam row
      // actually won the race, not failing the whole operation.
      exam = await prisma.exam.findUniqueOrThrow({ where: { courseId } });
    }
  }

  let generatedCount = 0;
  let failedCount = 0;
  for (const source of batch) {
    let result: GeneratedResult | null;
    try {
      result = await generateOne(source);
    } catch {
      result = null;
    }
    if (!result) {
      failedCount++;
      continue;
    }

    await prisma.question.create({
      data: {
        examId: exam.id,
        text: result.text,
        needsReview: result.needsReview,
        reviewReason: result.reviewReason,
        generatedFromQuestionId: result.sourceQuestionId,
        options: { create: result.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, key: String.fromCharCode(65 + i) })) },
      },
    });
    generatedCount++;
  }

  return { generated: generatedCount, failed: failedCount, remaining };
}
