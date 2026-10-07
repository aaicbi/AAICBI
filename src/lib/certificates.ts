/**
 * M15 — certificate issuance. The Prisma-dependent orchestration layer;
 * see the schema comment on Certificate for the "signed record, not
 * blockchain" design decision this whole file implements.
 */
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { notifyByEmail, shouldNotifyTrainee } from "@/lib/notifications/log";
import { certificateIssuedEmail, examCertificateIssuedEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";
import { buildCertificateDesignSnapshot, toSnapshotJson } from "@/lib/certificateDesignSnapshot";

// Alphabet excludes 0/O and 1/I/L — characters people reliably
// mis-transcribe when reading a code off a printed certificate or
// typing one in by hand. This code is meant for low-friction human use
// (unlike an exam's admin-only `code`, or a cuid `id`), so legibility
// matters more than a maximally dense character set.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCertificateCode(): string {
  const bytes = randomBytes(8);
  let raw = "";
  for (const b of bytes) raw += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `AAICBI-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

/**
 * M23 — certificate issuance, moved from "100% of modules complete" to
 * "passed the course examination." This function replaced
 * `checkAndIssueCertificate` (the M15 original) rather than sitting
 * alongside it — the roadmap's own framing is "moves" issuance to the
 * new trigger, not "also issues" on a second one, and the migration
 * this milestone ships with (`prisma/migrate-revoke-legacy-certificates.ts`)
 * exists specifically because there is no longer a second valid path to
 * a certificate. Reuses the exact same code generation and
 * notification logic as the original; only the trigger condition and
 * the caller changed.
 *
 * Called from examEngine.ts's submitAttempt, right where a course
 * examination's grading result actually becomes known — the same
 * "real-time, at the one moment this is knowable" reasoning already
 * used for M38's failed-attempts check a few lines away in that file.
 * Race-safe the same way as before: an individual `create()` with a
 * caught P2002, `@@unique([traineeId, courseId])` still doing the
 * actual work of guaranteeing at most one certificate per course.
 *
 * Never throws — a failure here must never affect exam submission
 * itself, the same reasoning as every other notification hook in this
 * project.
 */
export async function issueCertificateForPassedExam(attemptId: string, courseId: string, traineeId: string): Promise<void> {
  try {
    const existing = await prisma.certificate.findUnique({
      where: { traineeId_courseId: { traineeId, courseId } },
      select: { id: true, courseExamAttemptId: true },
    });
    // A genuine new-rule certificate already exists — nothing to do,
    // race-safety below is for the first issuance only.
    if (existing?.courseExamAttemptId) return;

    // Audit finding, fixed before it could cause real damage: this
    // used to stop entirely whenever ANY certificate row existed,
    // genuine or not. `@@unique([traineeId, courseId])` means at most
    // one certificate row can ever exist per trainee per course — so
    // an old-rule row (courseExamAttemptId null, whether the M17
    // migration revoked it or not) permanently blocks a plain
    // create() for that pair, forever. Verified this directly against
    // real Postgres: even a REVOKED old-rule row still violates the
    // unique constraint on a fresh insert. A trainee who genuinely
    // earned a real certificate under the new rule would silently
    // never receive one if they'd ever had an old-rule row. Fixed by
    // updating that existing row into a genuine one — new code, real
    // courseExamAttemptId, revokedAt cleared — rather than trying to
    // create a second row that can never exist.
    //
    // The update itself uses the same atomic-conditional pattern as
    // the M45 credit-balance fix earlier in this project: `updateMany`
    // with `courseExamAttemptId: null` in the WHERE clause, not a
    // plain `update`. A plain update on an already-fetched row is
    // last-write-wins under a genuine race (two near-simultaneous
    // passing attempts for the same trainee+course, an edge case but
    // not an impossible one) — the second call would silently
    // overwrite the first's result and BOTH would proceed to send a
    // duplicate notification, since neither hit a real conflict. This
    // WHERE-clause condition makes Postgres's own row lock do the
    // serializing: only the first concurrent call's WHERE clause still
    // matches by the time it executes.
    // Freeze the course's current certificate design onto the row so a
    // later template change can never re-design it (see
    // certificateDesignSnapshot.ts's own comment).
    const designSnapshot = toSnapshotJson(await buildCertificateDesignSnapshot(courseId));

    let certificate;
    try {
      if (existing) {
        const applied = await prisma.certificate.updateMany({
          where: { id: existing.id, courseExamAttemptId: null },
          data: { code: generateCertificateCode(), courseExamAttemptId: attemptId, revokedAt: null, designSnapshot },
        });
        if (applied.count === 0) return; // lost the race — someone else just turned this into a real certificate
        certificate = await prisma.certificate.findUniqueOrThrow({ where: { id: existing.id } });
      } else {
        certificate = await prisma.certificate.create({
          data: { code: generateCertificateCode(), traineeId, courseId, courseExamAttemptId: attemptId, designSnapshot },
        });
      }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") return; // lost the race — someone else just issued it; not my notification to send
      throw e;
    }

    // Course enrollment/subscription system — a real certificate being
    // issued right here IS the moment this course counts as completed;
    // see deriveEnrollmentStatus's own comment on why this is kept as
    // an independent, never re-derived historical fact, same treatment
    // this schema already gives Certificate itself. `completedAt: null`
    // in the WHERE clause makes this idempotent against a retry or a
    // second passing attempt somehow reaching here — never overwrites
    // an already-recorded completion date.
    await prisma.courseEnrollment.updateMany({
      where: { traineeId, courseId, completedAt: null },
      data: { completedAt: new Date() },
    });

    const trainee = await prisma.trainee.findUnique({ where: { id: traineeId } });
    if (!trainee || !shouldNotifyTrainee(trainee)) return;

    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
    if (!course) return;

    const relativeUrl = `/certificate/${certificate.code}`;
    const email = certificateIssuedEmail({
      traineeName: trainee.name,
      courseTitle: course.title,
      certificateCode: certificate.code,
      verificationUrl: appUrl(relativeUrl),
    });
    await notifyByEmail({
      recipientType: "TRAINEE",
      recipientId: traineeId,
      to: trainee.email,
      type: "CERTIFICATE_ISSUED",
      relatedId: certificate.id,
      // Same audit sweep — click takes the trainee straight to their
      // own new certificate.
      url: relativeUrl,
      subject: email.subject,
      html: email.html,
      text: email.text,
      // M43 — a genuine milestone moment, a natural fit for a second
      // channel.
      whatsapp: {
        templateName: "certificate_issued",
        variables: { name: trainee.name, course_title: course.title, certificate_code: certificate.code },
      },
    });
  } catch (e) {
    console.error(`Certificate issuance failed for trainee ${traineeId}, course ${courseId}, attempt ${attemptId}:`, e);
  }
}

/**
 * The standalone-exam counterpart to issueCertificateForPassedExam —
 * see ExamCertificate's own schema comment for why this is a separate
 * model/function rather than a generalization of the course one.
 * Deliberately simpler: no course enrollment to mark complete, no
 * course title to look up. Same race-safety shape (an individual
 * create(), P2002 caught and treated as "someone else just issued it")
 * since `@@unique([traineeId, examId])` is doing the real guarantee —
 * there's no legacy pre-existing-row case here the way the course
 * version has (this model has no history predating this feature), so
 * the update-existing-row branch that function needs doesn't apply.
 * Never throws — same reasoning as every other notification hook.
 */
export async function issueCertificateForPassedStandaloneExam(attemptId: string, examId: string, traineeId: string): Promise<void> {
  try {
    const existing = await prisma.examCertificate.findUnique({
      where: { traineeId_examId: { traineeId, examId } },
      select: { id: true },
    });
    if (existing) return;

    let certificate;
    try {
      certificate = await prisma.examCertificate.create({
        data: { code: generateCertificateCode(), traineeId, examId, examAttemptId: attemptId },
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") return; // lost the race — someone else just issued it
      throw e;
    }

    const trainee = await prisma.trainee.findUnique({ where: { id: traineeId } });
    if (!trainee || !shouldNotifyTrainee(trainee)) return;

    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { title: true } });
    if (!exam) return;

    const relativeUrl = `/certificate/${certificate.code}`;
    const email = examCertificateIssuedEmail({
      traineeName: trainee.name,
      examTitle: exam.title,
      certificateCode: certificate.code,
      verificationUrl: appUrl(relativeUrl),
    });
    await notifyByEmail({
      recipientType: "TRAINEE",
      recipientId: traineeId,
      to: trainee.email,
      type: "EXAM_CERTIFICATE_ISSUED",
      relatedId: certificate.id,
      url: relativeUrl,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  } catch (e) {
    console.error(`Exam certificate issuance failed for trainee ${traineeId}, exam ${examId}, attempt ${attemptId}:`, e);
  }
}

/**
 * Called when an admin flips certificateEnabled false->true on a
 * standalone exam (PUT /api/exams/[id]) — retroactively issues
 * certificates for every trainee who already passed before the toggle
 * existed, so "turn on certificates" doesn't silently exclude everyone
 * who already earned one. Reuses the exact same issuance function (and
 * its own idempotency/race-safety) per matching attempt, one at a time
 * — this exam's total attempt count is never large enough to need
 * batching.
 */
export async function issueRetroactiveExamCertificates(examId: string): Promise<void> {
  const passingAttempts = await prisma.attempt.findMany({
    where: { examId, status: "SUBMITTED", passed: true },
    select: { id: true, traineeId: true },
  });
  for (const attempt of passingAttempts) {
    await issueCertificateForPassedStandaloneExam(attempt.id, examId, attempt.traineeId);
  }
}
