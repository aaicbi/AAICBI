import { prisma } from "@/lib/prisma";

/**
 * Everything the "My Progress" surface shows, derived from data the
 * platform already holds: the AI performance summaries written after each
 * submitted assessment, the trainee's module completions, and their
 * active enrolments. Nothing here is new analysis; it is the existing
 * feedback pulled together across attempts so a trainee can see patterns
 * instead of one summary at a time.
 */
export interface TopicCount {
  topic: string;
  count: number;
}

export interface ProgressSurfaceData {
  readiness: {
    attemptsAnalysed: number;
    averageScore: number | null;
    latestScore: number | null;
    /** Latest score minus the average of the attempts before it. */
    scoreDelta: number | null;
  };
  strengths: TopicCount[];
  focus: TopicCount[];
  latestNote: {
    assessment: string;
    context: string | null;
    narrative: string;
    score: number | null;
    passed: boolean | null;
    when: string;
  } | null;
  courses: { id: string; title: string; completedModules: number; totalModules: number; href: string }[];
  nextStep: { text: string; label: string; href: string };
}

function topics(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim()) : [];
}

/** Count topics case-insensitively, keep the first spelling seen, most frequent first. */
export function tally(lists: string[][], limit: number): TopicCount[] {
  const counts = new Map<string, TopicCount>();
  for (const list of lists) {
    const seenInThisList = new Set<string>();
    for (const topic of list) {
      const key = topic.toLowerCase();
      if (seenInThisList.has(key)) continue;
      seenInThisList.add(key);
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { topic, count: 1 });
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, limit);
}

export function buildReadiness(percentages: number[]): ProgressSurfaceData["readiness"] {
  // `percentages` is newest first.
  if (percentages.length === 0) return { attemptsAnalysed: 0, averageScore: null, latestScore: null, scoreDelta: null };
  const recent = percentages.slice(0, 5);
  const average = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  const earlier = percentages.slice(1, 6);
  const delta = earlier.length ? Math.round(percentages[0] - earlier.reduce((a, b) => a + b, 0) / earlier.length) : null;
  return { attemptsAnalysed: percentages.length, averageScore: average, latestScore: Math.round(percentages[0]), scoreDelta: delta };
}

export async function getTraineeProgressSurface(traineeId: string): Promise<ProgressSurfaceData> {
  const [attempts, enrollments, completions] = await Promise.all([
    prisma.attempt.findMany({
      where: { traineeId, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      take: 20,
      select: {
        percentage: true,
        passed: true,
        submittedAt: true,
        exam: { select: { title: true, parentCourse: { select: { title: true } }, courseModule: { select: { title: true, course: { select: { title: true } } } } } },
        performanceSummary: { select: { strengths: true, weaknesses: true, narrative: true } },
      },
    }),
    prisma.courseEnrollment.findMany({
      where: { traineeId, unlockedAt: { not: null }, accessRevokedAt: null },
      select: { course: { select: { id: true, title: true, _count: { select: { modules: true } } } } },
    }),
    prisma.moduleCompletion.findMany({ where: { traineeId }, select: { module: { select: { courseId: true } } } }),
  ]);

  const summarised = attempts.filter((a) => a.performanceSummary);
  const doneByCourse = new Map<string, number>();
  for (const c of completions) doneByCourse.set(c.module.courseId, (doneByCourse.get(c.module.courseId) ?? 0) + 1);

  const courses = enrollments.map((e) => ({
    id: e.course.id,
    title: e.course.title,
    completedModules: Math.min(doneByCourse.get(e.course.id) ?? 0, e.course._count.modules),
    totalModules: e.course._count.modules,
    href: `/trainee/courses/${e.course.id}`,
  }));

  const strengths = tally(summarised.map((a) => topics(a.performanceSummary!.strengths)), 6);
  const focus = tally(summarised.map((a) => topics(a.performanceSummary!.weaknesses)), 6);
  const newest = summarised[0];
  const latestNote = newest
    ? {
        assessment: newest.exam.title,
        context: newest.exam.parentCourse?.title ?? newest.exam.courseModule?.course.title ?? null,
        narrative: newest.performanceSummary!.narrative,
        score: newest.percentage === null ? null : Math.round(newest.percentage),
        passed: newest.passed,
        when: newest.submittedAt ? newest.submittedAt.toISOString() : new Date().toISOString(),
      }
    : null;

  const unfinished = courses.filter((c) => c.totalModules > 0 && c.completedModules < c.totalModules).sort((a, b) => a.completedModules / a.totalModules - b.completedModules / b.totalModules);
  const nextStep: ProgressSurfaceData["nextStep"] =
    attempts.length === 0
      ? { text: "Take your first assessment and the AI will start building your picture here.", label: "Browse your courses", href: "/trainee/courses" }
      : focus[0]
        ? { text: `${focus[0].topic} keeps coming up. Revisit it before your next assessment.`, label: unfinished[0] ? "Continue learning" : "Open your courses", href: unfinished[0]?.href ?? "/trainee/courses" }
        : unfinished[0]
          ? { text: "No recurring gaps right now. Keep your momentum.", label: "Continue learning", href: unfinished[0].href }
          : { text: "You are up to date. Explore another course.", label: "Browse courses", href: "/courses" };

  return {
    readiness: buildReadiness(attempts.filter((a) => a.percentage !== null).map((a) => a.percentage as number)),
    strengths,
    focus,
    latestNote,
    courses,
    nextStep,
  };
}
