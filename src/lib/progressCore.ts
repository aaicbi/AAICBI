/**
 * The pure half of M12's locking engine — same split rationale as
 * rateLimitCore.ts, embeddingsCore.ts, and examEngineCore.ts: no
 * Prisma import, so this is testable without a database or the
 * Prisma client's generated types. src/lib/progress.ts is the
 * Prisma-dependent wrapper that fetches the real data and calls this.
 */

export interface ModuleProgressInput {
  id: string;
  order: number;
  totalLessons: number;
  completedLessons: number;
  /** Whether this module has a PUBLISHED assessment — an Exam row that
   * exists but isn't published yet doesn't count. See the "judgment
   * call" note on computeModuleProgress for why. */
  hasPublishedAssessment: boolean;
  /** Only meaningful when hasPublishedAssessment is true. */
  assessmentPassed: boolean;
}

export interface ModuleProgressResult {
  id: string;
  /** This module's own content/assessment is done. */
  completed: boolean;
  /** The trainee can access this module's lessons and take its
   * assessment. The first module (lowest order) is always unlocked. */
  unlocked: boolean;
}

/**
 * The per-module completion rule alone, split out from
 * computeModuleProgress so src/lib/progress.ts can call it separately
 * from the sequential unlock-chain logic below — needed for the
 * "sticky completion" fix (see the comment on ModuleCompletion in
 * schema.prisma): once a module is detected complete, that fact gets
 * persisted, and on every later call the persisted fact overrides
 * whatever this function would say fresh. This function itself stays
 * exactly what it was — the live, current-data answer — it just isn't
 * the ONLY answer anymore once something is sticky.
 */
export function computeModuleCompletion(m: ModuleProgressInput): boolean {
  return m.hasPublishedAssessment
    ? m.assessmentPassed
    : m.totalLessons === 0 || m.completedLessons >= m.totalLessons;
}

/**
 * The sequential unlock chain alone: given each module's `completed`
 * state (wherever it came from — live-computed, or a persisted sticky
 * fact), decide which modules are unlocked. First module always
 * unlocked; each later module unlocked only if the one immediately
 * before it (by order) is completed.
 */
export function computeUnlockedFromCompletion(
  modules: { id: string; order: number; completed: boolean }[]
): ModuleProgressResult[] {
  const sorted = [...modules].sort((a, b) => a.order - b.order);
  const results: ModuleProgressResult[] = [];
  let previousCompleted = true; // nothing before the first module — always unlocked

  for (const m of sorted) {
    results.push({ id: m.id, completed: m.completed, unlocked: previousCompleted });
    previousCompleted = m.completed;
  }

  return results;
}

/**
 * A module counts as "completed" — the gate the NEXT module checks —
 * by:
 *   - passing its assessment, if it has a published one, OR
 *   - completing every lesson in it, if it doesn't (a module with a
 *     published assessment is gated by that alone; lesson-completion
 *     doesn't additionally matter once there's a real assessment to
 *     measure against — matches the spec's "Module 2 stays locked
 *     until you SCORE 80% on Module 1" framing, not "...and also
 *     click through every lesson").
 *   - A module with neither lessons nor a published assessment
 *     (empty, or still being built) auto-completes — there's nothing
 *     to gate on, so it shouldn't silently block everything after it.
 *
 * Judgment call, documented rather than hidden: an Exam that exists
 * but isn't published (an admin still building/reviewing the bank)
 * does NOT count as "has an assessment" for locking purposes — it
 * falls back to lesson-completion. Otherwise, starting to build a
 * module's assessment would immediately lock every trainee out of the
 * modules after it, mid-edit, before the admin ever intended to gate
 * anything. Revisit if real usage says this default is wrong.
 *
 * Modules are locked/unlocked strictly by `order`: the first module is
 * always unlocked; each later module is unlocked only if the one
 * immediately before it (by order) is completed. A module skipped in
 * the ordering gap (e.g. order values 0, 2, 5 with nothing at 1, 3, 4)
 * is treated as following whatever the previous module IN THE SORTED
 * LIST is, not the previous order NUMBER — gaps in `order` don't
 * create phantom locked modules.
 *
 * This function is the pure, current-data-only answer — the shape
 * both computeModuleCompletion and computeUnlockedFromCompletion
 * combine to reproduce, kept as a single entry point because most
 * callers (and every existing test) don't need the split. The one
 * caller that does — src/lib/progress.ts, for the "sticky completion"
 * fix — uses the two split functions directly instead of this one.
 */
export function computeModuleProgress(modules: ModuleProgressInput[]): ModuleProgressResult[] {
  return computeUnlockedFromCompletion(modules.map((m) => ({ id: m.id, order: m.order, completed: computeModuleCompletion(m) })));
}

/**
 * M14: the module worth notifying a trainee about when
 * `completedModuleId` transitions to complete isn't itself — it's
 * whichever module comes immediately after it in `order` within the
 * same course (completing Module 1 is what makes Module 2 accessible
 * and notification-worthy, not Module 1). See the "TODO (M14 —
 * Notifications)" comment in progress.ts's getModuleLockMap for the
 * full reasoning — this is the pure lookup that comment points at.
 *
 * Returns null if there is no next module (the completed one was
 * last), or if `completedModuleId` isn't found in `modules` at all.
 */
export function findNextModule<T extends { id: string; order: number }>(
  modules: T[],
  completedModuleId: string
): T | null {
  const completed = modules.find((m) => m.id === completedModuleId);
  if (!completed) return null;

  const after = modules.filter((m) => m.order > completed.order).sort((a, b) => a.order - b.order);
  return after[0] ?? null;
}

/**
 * M15: a course is complete when every one of its modules is —
 * trivial, but given its own name and tests rather than inlined,
 * because "empty course" is a real edge case worth being explicit
 * about: a course with zero modules has nothing to have completed, so
 * it's never "complete" no matter how the check is phrased. Without
 * this guard, `.every()` on an empty array returns `true` by
 * vacuous-truth JavaScript semantics — exactly wrong here, since it
 * would mean a course with no content at all could "earn" a
 * certificate the instant a trainee viewed it.
 */
export function isCourseComplete(moduleCompletions: { completed: boolean }[]): boolean {
  return moduleCompletions.length > 0 && moduleCompletions.every((m) => m.completed);
}
