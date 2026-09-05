/**
 * The exam engine owns three security-critical rules from the master
 * prompt, all of which are easy to accidentally violate in a rushed
 * implementation — so they live in one file with one job each:
 *
 *  1. §40 — never send `isCorrect` or `explanation` to the browser for a
 *     question in an IN_PROGRESS attempt. `serveableQuestion()` is the
 *     only function allowed to shape a Question for client consumption
 *     before submission; every API route MUST route through it rather
 *     than returning a Prisma question object directly.
 *  2. §7 / §40 — the timer is cosmetic on the client. `expiresAt` is
 *     computed once, server-side, at attempt start, and every subsequent
 *     write checks against it. A student changing their device clock
 *     cannot extend their own time.
 *  3. §39 — grading happens once, atomically, on submit. Re-submitting an
 *     already-SUBMITTED attempt must be a no-op that returns the
 *     existing result, not a re-grade.
 */
import { prisma } from "@/lib/prisma";
import type { Attempt, Exam, Question, Option } from "@prisma/client";
import { reconstructOrderedItems } from "@/lib/examEngineCore";
import { computeTopicStats } from "@/lib/performanceCore";
import { generatePerformanceSummary } from "@/lib/ai/analyzePerformance";
import { rateLimit } from "@/lib/rateLimit";
import { notifyByEmail, shouldNotifyTrainee } from "@/lib/notifications/log";
import { assessmentResultEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";
import { getModuleLockMap } from "@/lib/progress";
import { checkFailedAttemptsThreshold } from "@/lib/earlyWarning";
import { issueCertificateForPassedExam } from "@/lib/certificates";

export interface ServeableOption {
  key: string;
  text: string;
}
export interface ServeableQuestion {
  id: string;
  text: string;
  options: ServeableOption[];
}

/** Strips every field a client must never see before the exam is submitted. */
export function serveableQuestion(
  question: Question & { options: Option[] },
  randomizeOptions: boolean
): ServeableQuestion {
  const options = randomizeOptions ? shuffle(question.options) : question.options;
  return {
    id: question.id,
    text: question.text,
    options: options.map((o) => ({ key: o.key, text: o.text })),
  };
}

export function secondsRemaining(attempt: Attempt): number {
  const ms = attempt.expiresAt.getTime() - Date.now();
  return Math.max(0, Math.round(ms / 1000));
}

export function isExpired(attempt: Attempt): boolean {
  return Date.now() > attempt.expiresAt.getTime();
}

/**
 * Starts a new attempt: picks the question set (respecting
 * numQuestions/randomizeQuestions), snapshots the order, and computes
 * expiresAt server-side. Enforces maxAttempts.
 *
 * M11 audit finding: this used to unconditionally create a new
 * Attempt row every call. Two real consequences of that — (a) a
 * trainee double-tapping "Start Assessment" on a slow connection could
 * race the maxAttempts check (both requests read the same prior
 * count, both pass, both try to create attemptNumber N+1, and the
 * second collides on the `[examId, traineeId, attemptNumber]` unique
 * constraint and throws a raw, confusing error), and (b) even without
 * any race, a trainee whose browser reloaded the instructions page
 * mid-attempt and clicked "Start" again would burn a second attempt
 * against their maxAttempts limit for no real reason. Fixed by making
 * this idempotent: if an unexpired IN_PROGRESS attempt already exists
 * for this trainee+exam, resume it instead of creating a new one. The
 * unique-constraint collision itself is still handled as a last-resort
 * fallback below, for the narrow window between the check and the
 * create.
 */
export async function startAttempt(exam: Exam & { questions: (Question & { options: Option[] })[] }, traineeId: string) {
  if (!exam.published) {
    throw httpError(403, "This examination is not currently open.");
  }

  const existing = await prisma.attempt.findFirst({
    where: { examId: exam.id, traineeId, status: "IN_PROGRESS" },
    orderBy: { attemptNumber: "desc" },
  });
  if (existing) {
    if (!isExpired(existing)) {
      return { attempt: existing, orderedQuestions: reconstructOrderedItems(exam.questions, existing.questionOrder) };
    }
    // A stale IN_PROGRESS row past its own expiresAt (the trainee never
    // came back to submit it) — clean it up before starting fresh
    // rather than leaving two IN_PROGRESS rows for the same exam+trainee.
    await expireAttempt(existing.id);
  }

  const priorAttempts = await prisma.attempt.count({
    where: { examId: exam.id, traineeId },
  });
  if (exam.maxAttempts !== null && priorAttempts >= exam.maxAttempts) {
    throw httpError(403, "You have used all your allowed attempts for this examination.");
  }

  // Audit finding, fixed here rather than patched separately in every
  // route that calls this function: nothing filtered this pool by
  // needsReview at all, in either the module-assessment or course-
  // examination path. The publish gate (POST /api/exams/[id]/publish)
  // blocks publishing an exam WHILE any question still needs review —
  // but it doesn't protect an exam that's already published from
  // later accumulating new unreviewed questions, which M21's "Generate
  // More Questions" on an already-published course exam makes a real,
  // not just theoretical, way to reach that state: a disagreement-
  // flagged question, possibly with the wrong option marked correct,
  // could otherwise be served to a trainee before any human looked at
  // it. Filtered at the one shared point both exam types actually
  // start an attempt through, so every caller is protected the same
  // way, not just the one this was found while building.
  const reviewedQuestions = exam.questions.filter((q) => !q.needsReview);

  let pool = [...reviewedQuestions];
  if (exam.randomizeQuestions) pool = shuffle(pool);
  if (exam.numQuestions && exam.numQuestions < pool.length) {
    pool = pool.slice(0, exam.numQuestions);
  }
  if (pool.length === 0) {
    throw httpError(400, "This examination has no published questions yet.");
  }

  const expiresAt = new Date(Date.now() + exam.durationMinutes * 60_000);

  try {
    const attempt = await prisma.attempt.create({
      data: {
        examId: exam.id,
        traineeId,
        attemptNumber: priorAttempts + 1,
        expiresAt,
        questionOrder: pool.map((q) => q.id),
        // M11 audit finding — see the schema comment on
        // Attempt.passMarkPercent: snapshotted here so grading at
        // submit time can't be affected by a pass-mark change an
        // instructor makes while this attempt is still in progress.
        passMarkPercent: exam.passMarkPercent,
      },
    });
    return { attempt, orderedQuestions: pool };
  } catch (e) {
    // Last-resort race handling: two concurrent calls both passed the
    // `existing` check above (neither saw the other's row yet) and
    // both tried to create attemptNumber N+1 — the loser hits Prisma's
    // unique-constraint error (P2002) here. Rather than surface that
    // raw, re-fetch whichever attempt actually won and hand it back;
    // from the trainee's point of view this should look identical to
    // the resume-existing-attempt path above, not an error.
    const code = (e as { code?: string }).code;
    if (code === "P2002") {
      const winner = await prisma.attempt.findFirst({
        where: { examId: exam.id, traineeId, status: "IN_PROGRESS" },
        orderBy: { attemptNumber: "desc" },
      });
      if (winner) {
        return { attempt: winner, orderedQuestions: reconstructOrderedItems(exam.questions, winner.questionOrder) };
      }
    }
    throw e;
  }
}

/**
 * Records one answer. Rejects writes against an expired or already
 * submitted attempt — this is the enforcement point for "server
 * validates timing," not just the submit route, since a determined
 * client could otherwise keep answering past expiry.
 */
export async function recordAnswer(attemptId: string, questionId: string, selectedOptionKey: string | null) {
  const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });

  if (attempt.status !== "IN_PROGRESS") {
    throw httpError(409, "This attempt has already been submitted.");
  }
  if (isExpired(attempt)) {
    await expireAttempt(attempt.id);
    throw httpError(409, "Time is up — this attempt has been automatically submitted.");
  }

  await prisma.answer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    update: { selectedOptionKey, answeredAt: new Date() },
    create: { attemptId, questionId, selectedOptionKey },
  });
}

/**
 * Grades and finalizes an attempt. Idempotent: calling this twice on an
 * already-submitted attempt just returns the stored result rather than
 * re-grading (§39).
 */
export async function submitAttempt(attemptId: string) {
  const attempt = await prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { answers: true },
  });

  if (attempt.status === "SUBMITTED") {
    return attempt; // already graded — no-op
  }

  const questionIds = (attempt.questionOrder as string[]) ?? [];
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    include: { options: true },
  });

  let correct = 0;
  for (const answer of attempt.answers) {
    const question = questions.find((q) => q.id === answer.questionId);
    const correctOption = question?.options.find((o) => o.isCorrect);
    const isCorrect = !!correctOption && correctOption.key === answer.selectedOptionKey;
    if (isCorrect) correct++;
    await prisma.answer.update({
      where: { id: answer.id },
      data: { isCorrect },
    });
  }

  const exam = await prisma.exam.findUniqueOrThrow({
    where: { id: attempt.examId },
    include: { courseModule: { select: { courseId: true } } },
  });
  const total = questionIds.length;
  const percentage = total > 0 ? (correct / total) * 100 : 0;
  // M11 audit finding: use the pass mark snapshotted at attempt start
  // (see the schema comment on Attempt.passMarkPercent) rather than
  // whatever exam.passMarkPercent happens to be right now — an
  // instructor changing the pass mark while this attempt was
  // IN_PROGRESS must not retroactively change how it's graded.
  // Falls back to the exam's current value only for an attempt row
  // that predates this field (passMarkPercent is null on those).
  const passMarkPercent = attempt.passMarkPercent ?? exam.passMarkPercent;
  const passed = percentage >= passMarkPercent;

  // M13 audit finding: this used to be a plain `attempt.update`, with
  // no protection against two near-simultaneous calls to
  // submitAttempt() for the same attempt both passing the "not yet
  // SUBMITTED" check above before either had written anything — a real
  // scenario (the client's timer-expiry auto-submit racing a
  // server-side auto-expire triggered by a trailing answer save, for
  // example). Before M13 that just double-wrote identical scores
  // harmlessly. After M13 it could also fire two separate, billed AI
  // calls for the same attempt. Fixed with a conditional update:
  // `updateMany` with `status: { not: "SUBMITTED" }` in the WHERE
  // clause is atomic at the database row level, so only ONE concurrent
  // caller can ever have `count === 1` here — the other sees `0` and
  // knows it lost the race, so it returns the winner's result instead
  // of re-grading or re-analyzing.
  const claimed = await prisma.attempt.updateMany({
    where: { id: attemptId, status: { not: "SUBMITTED" } },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      score: correct,
      totalQuestions: total,
      percentage,
      passed,
    },
  });

  if (claimed.count === 0) {
    // Lost the race — another concurrent call already finalized this
    // attempt (and already ran, or is running, the M13 analysis below).
    // Return its result rather than doing any of that a second time.
    return prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
  }

  const graded = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });

  // TODO (M14 — Notifications): this is the hook point for the
  // "assessment result" email the roadmap names for M14 — grading is
  // fully committed above this line (the atomic updateMany gate has
  // already resolved), so `graded` is the real, final result and this
  // is a safe place to trigger a result email. Follow the same
  // graceful-degradation pattern as the AI analysis right below: wrap
  // it in its own try/catch, never let a failed/slow email send affect
  // what the trainee sees or whether their submission succeeds.

  // M13 — analyze once, right here, right after grading finishes (per
  // the roadmap's explicit instruction), never before this point:
  // grading itself must always succeed and already has, regardless of
  // what happens next. See the schema comment on PerformanceSummary
  // for the full latency/cost tradeoff and why this runs inline rather
  // than in a background job. Wrapped so that ANY failure here —
  // missing API key, a network error, a malformed response — is fully
  // swallowed: a trainee's submission must never fail, or even look
  // different to them, because performance analysis didn't work.
  let generatedSummary: { strengths: string[]; weaknesses: string[]; narrative: string } | null = null;
  try {
    // M13 audit finding: an unbounded cost surface — every submitted
    // attempt fired a real, billed AI call with nothing capping how
    // many times that could happen per trainee. An assessment with no
    // `maxAttempts` set (a real, normal configuration) plus a trainee
    // retaking it repeatedly had no ceiling at all. Reuses the same
    // Postgres-backed rate limiter the auth routes already use (see
    // rateLimit.ts) rather than inventing new infrastructure — 20
    // summaries per trainee per rolling day, generous enough not to
    // get in the way of genuine retakes, low enough to bound the cost
    // of a runaway or careless retry loop. A trainee who hits the cap
    // simply doesn't get a summary for that attempt — same silent,
    // graceful degradation as every other way this can not happen.
    const { allowed } = await rateLimit(`perf-summary:${attempt.traineeId}`, 20, 24 * 60 * 60 * 1000);

    if (allowed) {
      // M13 audit finding: every ASSIGNED question, not just answered
      // ones — an unanswered question already counts against the
      // trainee's overall score (the total-questions denominator
      // above), so it must count against its topic too, or a topic
      // where they ran out of time partway through would look
      // artificially strong. See performanceCore.ts's own comment on
      // this exact point.
      //
      // Also tracks `answered` separately from `isCorrect` now — the
      // AI has no way to tell "genuinely got this wrong" from "never
      // attempted it" from a bare correct/total ratio, and those
      // deserve different-confidence language in the narrative (a
      // trainee who ran out of time on a topic isn't demonstrated to
      // be weak in it, just unfinished). See performanceCore.ts and
      // analyzePerformance.ts's prompt for how this gets used.
      const answerByQuestionId = new Map<string, { selectedOptionKey: string | null }>(
        attempt.answers.map((a: { questionId: string; selectedOptionKey: string | null }) => [a.questionId, a])
      );
      const topicAnswers = questions.map(
        (q: { id: string; topic: string | null; options: { key: string; isCorrect: boolean }[] }) => {
          const answer = answerByQuestionId.get(q.id);
          const correctOption = q.options.find((o: { isCorrect: boolean }) => o.isCorrect);
          const isCorrect = !!answer && !!correctOption && correctOption.key === answer.selectedOptionKey;
          return { topic: q.topic, isCorrect, answered: !!answer };
        }
      );
      const topicStats = computeTopicStats(topicAnswers);

      const summary = await generatePerformanceSummary(topicStats, percentage, passed);
      if (summary) {
        generatedSummary = summary;
        await prisma.performanceSummary.upsert({
          where: { attemptId },
          update: { strengths: summary.strengths, weaknesses: summary.weaknesses, narrative: summary.narrative },
          create: {
            attemptId,
            strengths: summary.strengths,
            weaknesses: summary.weaknesses,
            narrative: summary.narrative,
          },
        });
      }
    }
  } catch (e) {
    console.error(`Performance summary generation threw for attempt ${attemptId}:`, e);
  }

  // M14 — the assessment-result email. Deliberately gated on
  // `exam.showResultImmediately`: if results are withheld from the
  // trainee's own view (an admin-configured setting), emailing the
  // score immediately would undermine that decision through a side
  // channel. There's no separate "release this attempt's result"
  // action anywhere in this project — showResultImmediately is a
  // static exam-level setting, not a per-attempt toggle — so "skip the
  // email entirely when withheld" is the complete, correct behavior
  // here, not a partial one waiting on a later trigger that doesn't
  // exist.
  //
  // M14 audit finding: this had no cost/spam cap of its own, unlike
  // the AI summary right above it — the same unbounded-retakes
  // scenario M13 fixed for the AI call (an assessment with no
  // maxAttempts set has no ceiling on how many times a trainee can
  // submit) applied identically here and was never carried over. A
  // separate rate-limit key from the AI summary's — capping how many
  // emails a trainee can trigger isn't the same resource as capping
  // how many AI calls they trigger, and email is cheap enough to
  // afford a slightly more generous ceiling than the AI summary gets.
  try {
    if (exam.showResultImmediately) {
      const { allowed } = await rateLimit(`assessment-result-email:${attempt.traineeId}`, 30, 24 * 60 * 60 * 1000);
      const trainee = allowed ? await prisma.trainee.findUnique({ where: { id: attempt.traineeId } }) : null;
      if (trainee && shouldNotifyTrainee(trainee)) {
        const relativeUrl = exam.courseModule
          ? `/trainee/courses/${exam.courseModule.courseId}`
          : "/trainee/dashboard";
        const courseUrl = appUrl(relativeUrl);
        const email = assessmentResultEmail({
          traineeName: trainee.name,
          examTitle: exam.title,
          score: graded.score ?? 0,
          totalQuestions: graded.totalQuestions ?? 0,
          percentage: graded.percentage ?? 0,
          passed: graded.passed ?? false,
          passMarkPercent: attempt.passMarkPercent ?? exam.passMarkPercent,
          courseUrl,
          performanceSummary: generatedSummary,
        });
        await notifyByEmail({
          recipientType: "TRAINEE",
          recipientId: trainee.id,
          to: trainee.email,
          type: "ASSESSMENT_RESULT",
          relatedId: attemptId,
          // Same audit sweep as MODULE_UNLOCKED and QA_REPLY — the
          // relative path so a bell click lands the trainee on the
          // course this result belongs to, not nowhere.
          url: relativeUrl,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
      }
    }
  } catch (e) {
    console.error(`Assessment-result email failed for attempt ${attemptId}:`, e);
  }

  // Whole-project audit finding: certificate issuance and the "next
  // module unlocked" notification both live inside getModuleLockMap()
  // (see progress.ts) — but nothing ever called it from here. That
  // function only ever ran when a trainee's course page, dashboard, or
  // a lesson/attempt action happened to load again, which meant a
  // trainee who passed the assessment completing their LAST module and
  // simply closed the browser — a natural thing to do when you're
  // finished with a course — could go an indefinite amount of time,
  // possibly forever if they never revisited that course or their
  // dashboard, without their certificate or its notification ever
  // firing. Fixed by triggering the same check immediately, right
  // here, whenever the exam being graded belongs to a module. Placed
  // after the result email above, not before, so a trainee's inbox
  // reads in the order things actually happened: their result first,
  // then (if this was the module/course that finishes things) what
  // that result unlocked.
  //
  // Safe to call even if the trainee later revisits the course page or
  // dashboard too — the sticky-completion design (ModuleCompletion,
  // Certificate's own @@unique constraint) means a second call
  // correctly detects "nothing new here" and does nothing twice.
  if (exam.courseModule) {
    try {
      await getModuleLockMap(exam.courseModule.courseId, attempt.traineeId);
    } catch (e) {
      console.error(`Post-submission completion check failed for attempt ${attemptId}:`, e);
    }

    // M38 — the FAILED_ATTEMPTS half of the Staff Early-Warning
    // Dashboard, genuinely real-time: this is the one and only moment
    // a failing attempt is actually known to have happened, so it's
    // the correct place to check. Scoped to module assessments only
    // (the same `exam.courseModule` guard as the block above) — a
    // course-wide examination's own failures aren't included here yet,
    // since that exam type doesn't exist in this app until M21 ships;
    // worth revisiting whether it should count toward this same
    // per-course threshold once it does, not decided here.
    try {
      await checkFailedAttemptsThreshold(attempt.traineeId, attempt.examId, exam.courseModule.courseId);
    } catch (e) {
      console.error(`Early-warning failed-attempts check failed for attempt ${attemptId}:`, e);
    }
  }

  // M23 — the actual new trigger this milestone moved certificate
  // issuance to. `exam.courseId` set (and `courseModule` null, the
  // branch above) is what makes this a course-wide examination rather
  // than a module assessment — same real-time, "the one moment this is
  // knowable" reasoning as the failed-attempts check right above.
  // Deliberately `graded.passed`, not just "submitted": failing the
  // course examination is a genuine, normal outcome that earns nothing,
  // the same way failing a module assessment doesn't unlock the next
  // module.
  if (exam.courseId && graded.passed) {
    try {
      await issueCertificateForPassedExam(attemptId, exam.courseId, attempt.traineeId);
    } catch (e) {
      console.error(`Certificate issuance failed for attempt ${attemptId}:`, e);
    }
  }

  return graded;
}

/** The auto-expire-then-grade sequence, exported (was previously
 * private) so it can be reused by expireStaleAttemptsForTrainee below
 * — see that function's comment for why. */
export async function expireAttempt(attemptId: string) {
  await prisma.attempt.update({
    where: { id: attemptId },
    data: { status: "EXPIRED" },
  });
  await submitAttempt(attemptId);
}

/**
 * M13 audit finding: an attempt a trainee starts and then never
 * touches again — no answer ever recorded, no later visit to
 * re-trigger the resume-check in startAttempt() — sits `IN_PROGRESS`
 * forever. Nothing in the M9-era exam engine ever calls
 * expireAttempt()/submitAttempt() on it, so it's never graded and
 * (now, with M13) never analyzed either. There's no background job
 * infrastructure in this project to sweep these on a schedule (a
 * Vercel Cron hitting a dedicated endpoint would be the natural way to
 * do that properly later) — this is the lower-infrastructure interim
 * fix: called from the trainee dashboard page load (see that page),
 * the one place already guaranteed to run whenever a trainee actually
 * comes back to the platform. Honest about its limit: a trainee who
 * never revisits the dashboard again (bookmarks a course URL directly,
 * say) still won't get swept. Better than nothing, not a guarantee.
 */
export async function expireStaleAttemptsForTrainee(traineeId: string): Promise<void> {
  const stale = await prisma.attempt.findMany({
    where: { traineeId, status: "IN_PROGRESS", expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  for (const a of stale) {
    await expireAttempt(a.id);
  }
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function httpError(status: number, message: string) {
  const err = new Error(message) as Error & { status?: number };
  err.status = status;
  return err;
}
