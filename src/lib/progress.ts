/**
 * The Prisma-dependent half of M12's locking engine — fetches what
 * progressCore.ts needs for a real trainee and course, and shapes the
 * result into whatever each caller needs. Three callers, all needing
 * the same underlying computation:
 *   - GET /api/courses/[id] (trainee branch) — to redact locked
 *     modules' materials before returning the tree.
 *   - PUT /api/lessons/[id]/progress — to reject marking a lesson
 *     complete inside a locked module.
 *   - POST /api/modules/[id]/attempts — to reject starting an
 *     assessment inside a locked module.
 *
 * M12 audit finding, fixed here: completion used to be answered fresh
 * from live data on every call — see the long comment on
 * ModuleCompletion in schema.prisma for why that's wrong (a module's
 * own completion rule can change after a trainee already met the old
 * one, most plausibly when an instructor publishes a module's
 * assessment after trainees already completed it via the
 * lesson-completion fallback — and their real progress, and everything
 * unlocked because of it, would silently vanish). Completion is now
 * sticky: checked against ModuleCompletion first, and only computed
 * live (via progressCore.ts) for a module that doesn't have a
 * persisted completion row yet — the moment one is newly detected as
 * complete, it's written here, once, permanently.
 */
import { prisma } from "@/lib/prisma";
import { computeModuleCompletion, computeUnlockedFromCompletion, findNextModule, type ModuleProgressResult } from "@/lib/progressCore";
import { notifyByEmail, shouldNotifyTrainee } from "@/lib/notifications/log";
import { moduleUnlockedEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";
import { checkAndIssueBadges } from "@/lib/badges";

export interface ModuleLockMap {
  [moduleId: string]: ModuleProgressResult;
}

/**
 * Computes lock/completion status for every module in a course, for
 * one trainee.
 */
export async function getModuleLockMap(courseId: string, traineeId: string): Promise<ModuleLockMap> {
  const modules = await prisma.module.findMany({
    where: { courseId },
    select: {
      id: true,
      order: true,
      title: true,
      lessons: { select: { id: true } },
      assessment: {
        select: {
          id: true,
          published: true,
          attempts: {
            where: { traineeId, status: "SUBMITTED", passed: true },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  if (modules.length === 0) return {};

  const moduleIds = modules.map((m: { id: string }) => m.id);

  const [existingCompletions, lessonProgressRows] = await Promise.all([
    prisma.moduleCompletion.findMany({
      where: { traineeId, moduleId: { in: moduleIds } },
      select: { moduleId: true },
    }),
    prisma.lessonProgress.findMany({
      where: {
        traineeId,
        lessonId: { in: modules.flatMap((m: { lessons: { id: string }[] }) => m.lessons.map((l: { id: string }) => l.id)) },
      },
      select: { lessonId: true },
    }),
  ]);

  const alreadyCompletedModuleIds = new Set(existingCompletions.map((c: { moduleId: string }) => c.moduleId));
  const completedLessonIds = new Set(lessonProgressRows.map((p: { lessonId: string }) => p.lessonId));

  // Sticky read: a module already has a persisted completion → that's
  // the answer, full stop, regardless of what the live rule says now.
  // Only a module WITHOUT one yet gets the live rule applied.
  const completions = modules.map(
    (m: {
      id: string;
      order: number;
      lessons: { id: string }[];
      assessment: { published: boolean; attempts: unknown[] } | null;
    }) => {
      const alreadyPersisted = alreadyCompletedModuleIds.has(m.id);
      const liveCompleted =
        alreadyPersisted ||
        computeModuleCompletion({
          id: m.id,
          order: m.order,
          totalLessons: m.lessons.length,
          completedLessons: m.lessons.filter((l: { id: string }) => completedLessonIds.has(l.id)).length,
          hasPublishedAssessment: !!m.assessment?.published,
          assessmentPassed: (m.assessment?.attempts.length ?? 0) > 0,
        });
      return { id: m.id, order: m.order, completed: liveCompleted, newlyCompleted: !alreadyPersisted && liveCompleted };
    }
  );

  // Sticky write: persist every module that JUST became complete for
  // this call, so it can never be re-locked by a later change to its
  // own rule.
  //
  // M14 audit follow-through: this used to be a single bulk
  // `createMany({ skipDuplicates: true })`, which is fine for the lock
  // computation itself but useless for notifications — it returns only
  // a count, never which rows actually landed vs. which were silently
  // skipped as duplicates. Two near-simultaneous calls could both
  // compute the same `newlyCompleted` entry and both believe they were
  // the one who "just" unlocked it, double-sending the email. Switched
  // to individual `create()` calls (newlyCompleted is normally 0-1
  // items per call, so this isn't a hot-path efficiency concern) so a
  // caught P2002 gives an exact, per-module "I lost this race, someone
  // else already has it — not my job to notify" signal.
  const newlyCompleted = completions.filter((c: { newlyCompleted: boolean }) => c.newlyCompleted);
  const justUnlockedModuleIds: string[] = [];
  for (const c of newlyCompleted) {
    try {
      await prisma.moduleCompletion.create({ data: { moduleId: c.id, traineeId } });
      justUnlockedModuleIds.push(c.id);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "P2002") throw e; // a real error — don't swallow it
      // else: another concurrent call already created this row — not my notification to send.
    }
  }

  // M14 — the "module unlocked" notification. See the comment above
  // for why `justUnlockedModuleIds` (not `newlyCompleted`) is the
  // precise, race-safe signal for "I am the one who should notify."
  // Wrapped so a failed/slow send can never affect the lock
  // computation this function's callers actually depend on.
  if (justUnlockedModuleIds.length > 0) {
    try {
      const trainee = await prisma.trainee.findUnique({ where: { id: traineeId } });
      if (trainee && shouldNotifyTrainee(trainee)) {
        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
        for (const completedModuleId of justUnlockedModuleIds) {
          // The module worth notifying about is the NEXT one in
          // sequence, not the one that just completed — see
          // findNextModule's own doc comment for the full reasoning.
          const nextModule = findNextModule<{ id: string; order: number; title: string }>(modules, completedModuleId);
          if (!nextModule || !course) continue; // completed module was last, or course vanished mid-request — nothing to notify about
          const nextModuleUrl = `/trainee/courses/${courseId}`;
          const email = moduleUnlockedEmail(trainee.name, course.title, nextModule.title, appUrl(nextModuleUrl));
          await notifyByEmail({
            recipientType: "TRAINEE",
            recipientId: traineeId,
            to: trainee.email,
            type: "MODULE_UNLOCKED",
            relatedId: nextModule.id,
            // Part of the same audit sweep that fixed QA_REPLY earlier
            // — the relative path (not appUrl()'s absolute form, which
            // is only for the email button) so a bell click lands the
            // trainee on the course the newly-unlocked module belongs
            // to, instead of going nowhere.
            url: nextModuleUrl,
            subject: email.subject,
            html: email.html,
            text: email.text,
            // M43 — real, likely to fire for an actively-progressing
            // trainee.
            whatsapp: {
              templateName: "module_unlocked",
              variables: { name: trainee.name, course_title: course.title, module_title: nextModule.title },
            },
          });
        }
      }
    } catch (e) {
      console.error(`Module-unlocked notification failed for trainee ${traineeId}, course ${courseId}:`, e);
    }
  }

  const results = computeUnlockedFromCompletion(completions);
  const map: ModuleLockMap = {};
  for (const r of results) map[r.id] = r;

  // M23 — the old "100% of modules complete issues a certificate"
  // trigger that used to live right here was removed, not left running
  // alongside the new one. Certificates now issue only from passing the
  // course examination (see certificates.ts's issueCertificateForPassedExam,
  // called from examEngine.ts's submitAttempt) — this milestone moved
  // the trigger, it didn't add a second path to the same credential.

  // M20 — same reasoning, same call site, same `completions` data
  // reused a third time: this is also the cheapest place to ask "did
  // this trainee just cross 25/50/75% of this course's modules." See
  // badges.ts for the actual issuance logic. Badges are unaffected by
  // M23 — still tied to module-completion percentage, unlike
  // certificates, which is a real, deliberate difference between the
  // two: a badge is progress-tracking, never a credential the way a
  // certificate is (see the schema comment on Badge).
  await checkAndIssueBadges(courseId, traineeId, completions);

  return map;
}

/** Convenience wrapper for the enforcement call sites (lesson
 * progress, attempt start, assessment metadata) that only need one
 * module's status, not the whole course's — still computes the whole
 * course's map internally (locking is inherently sequential, can't be
 * answered for one module in isolation) but only hands back what the
 * caller asked for. */
export async function getModuleLockStatus(
  courseId: string,
  moduleId: string,
  traineeId: string
): Promise<ModuleProgressResult | null> {
  const map = await getModuleLockMap(courseId, traineeId);
  return map[moduleId] ?? null;
}

export interface ResumeTarget {
  url: string;
  label: string;
}

/**
 * Design-pass addition — the actual "continue where you left off"
 * pattern this whole redesign was built around: not just linking back
 * to a course's overview page, but to the exact next piece of content
 * a trainee would do next, matching the pattern every real course
 * platform researched for this redesign already uses (Udacity,
 * MasterClass, Coursera all lead with this).
 *
 * Reuses getModuleLockMap directly rather than re-deriving lock/
 * completion status a second way — the one existing function this
 * whole locking system already trusts for that answer.
 *
 * The first unlocked-but-incomplete module, in course order, is
 * "what the trainee is currently on." Within it: the first lesson
 * without a progress row is the real next step. If every lesson is
 * done but the module itself isn't (its own assessment is still
 * unpassed — see ModuleCompletion's own schema comment for why lesson
 * completion alone isn't sufficient for a module with an assessment),
 * the resume target is that assessment instead, not a lesson that
 * doesn't exist. Returns null when there's genuinely nothing to
 * resume — every module done, or the course has none yet — so the
 * caller can fall back to the course page rather than link somewhere
 * that doesn't make sense.
 */
export async function getResumeTarget(courseId: string, traineeId: string): Promise<ResumeTarget | null> {
  const lockMap = await getModuleLockMap(courseId, traineeId);

  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      assessment: { select: { id: true, published: true } },
      lessons: { orderBy: { order: "asc" }, select: { id: true, title: true } },
    },
  });

  const currentModule = modules.find(
    (m: { id: string }) => lockMap[m.id]?.unlocked && !lockMap[m.id]?.completed
  );
  if (!currentModule) return null;

  const lessonIds = currentModule.lessons.map((l: { id: string }) => l.id);
  const progressRows =
    lessonIds.length === 0
      ? []
      : await prisma.lessonProgress.findMany({
          where: { traineeId, lessonId: { in: lessonIds } },
          select: { lessonId: true },
        });
  const completedLessonIds = new Set(progressRows.map((p: { lessonId: string }) => p.lessonId));

  const nextLesson = currentModule.lessons.find((l: { id: string }) => !completedLessonIds.has(l.id));
  if (nextLesson) {
    return { url: `/trainee/lessons/${nextLesson.id}`, label: nextLesson.title };
  }

  // Every lesson in this module is done, but the module itself isn't
  // — its own assessment must still be unpassed. Only ever point there
  // if it's genuinely published; an unpublished assessment isn't a
  // real destination a trainee could act on yet.
  if (currentModule.assessment?.published) {
    return {
      url: `/trainee/courses/${courseId}/modules/${currentModule.id}/assessment`,
      label: `${currentModule.title} assessment`,
    };
  }

  return null;
}
