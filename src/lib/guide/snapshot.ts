import { prisma } from "@/lib/prisma";
import { getAnalyticsContentPerformance, getAnalyticsInsights, getAnalyticsOverview, getAnalyticsSearchDemand } from "@/lib/loop/tools";
import { getModuleAssessmentStats, getPerformanceKpis } from "@/lib/performanceDashboard";
import { EASY_QUESTION_PCT, HARD_QUESTION_PCT, MIN_QUESTION_ANSWERS, type CourseHealth, type QuestionStat, type Snapshot } from "@/lib/guide/monitorCore";

/**
 * Gathers the platform's aggregate numbers for monitoring: analytics, lesson
 * materials, assessments and performance. Every query here is a read, and
 * every number is a count or an average: no trainee is named, and no email,
 * message or answer text from a trainee is read. It reuses the same read-only
 * functions the Command Center's assistant and the dashboards already use.
 */
const MAX_COURSES = 25;
const QUESTION_POOL = 600;

export async function buildSnapshot(periodDays = 30): Promise<Snapshot> {
  const [overview, insights, content, search] = await Promise.all([
    getAnalyticsOverview(periodDays).catch(() => null),
    getAnalyticsInsights(periodDays).catch(() => null),
    getAnalyticsContentPerformance(periodDays).catch(() => null),
    getAnalyticsSearchDemand(periodDays).catch(() => null),
  ]);

  const courses = await prisma.course.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: MAX_COURSES,
    select: {
      id: true,
      title: true,
      courseExamination: { select: { published: true } },
      modules: { orderBy: { order: "asc" }, select: { id: true, title: true, assessment: { select: { id: true } }, lessons: { select: { materials: { select: { type: true } } } } } },
      _count: { select: { courseEnrollments: true } },
    },
  });

  const health: CourseHealth[] = [];
  for (const c of courses) {
    const [stats, kpis] = await Promise.all([getModuleAssessmentStats(c.id).catch(() => []), getPerformanceKpis(c.id).catch(() => null)]);
    const materialTypes: Record<string, number> = {};
    let lessons = 0;
    let materials = 0;
    let lessonsWithoutMaterials = 0;
    let modulesWithoutLessons = 0;
    for (const m of c.modules) {
      if (m.lessons.length === 0) modulesWithoutLessons++;
      for (const l of m.lessons) {
        lessons++;
        if (l.materials.length === 0) lessonsWithoutMaterials++;
        for (const mat of l.materials) {
          materials++;
          materialTypes[mat.type] = (materialTypes[mat.type] ?? 0) + 1;
        }
      }
    }
    health.push({
      id: c.id,
      title: c.title,
      modules: c.modules.length,
      lessons,
      materials,
      materialTypes,
      modulesWithoutLessons,
      lessonsWithoutMaterials,
      modulesWithoutAssessment: c.modules.filter((m) => !m.assessment).length,
      hasPublishedExam: c.courseExamination?.published ?? false,
      trainees: kpis?.totalTrainees ?? c._count.courseEnrollments,
      averageCompletionPct: kpis ? kpis.averageCompletionPct : null,
      averageAssessmentScore: kpis ? kpis.averageAssessmentScore : null,
      atRiskCount: kpis?.atRiskCount ?? 0,
      certificationRate: kpis ? kpis.certificationRate : null,
      moduleStats: stats.map((s) => ({ title: s.moduleTitle, hasAssessment: s.hasAssessment, totalAttempts: s.totalAttempts, averagePercentage: s.averagePercentage, passRate: s.passRate })),
    });
  }

  // Item analysis: how often each module-assessment question is answered correctly.
  const questions = await prisma.question.findMany({
    where: { exam: { moduleId: { not: null }, courseModule: { course: { status: "PUBLISHED" } } } },
    take: QUESTION_POOL,
    select: { id: true, text: true, exam: { select: { courseModule: { select: { title: true, course: { select: { title: true } } } } } } },
  });
  const grouped = questions.length
    ? await prisma.answer.groupBy({ by: ["questionId", "isCorrect"], where: { questionId: { in: questions.map((q) => q.id) }, isCorrect: { not: null } }, _count: { _all: true } })
    : [];
  const tally = new Map<string, { right: number; total: number }>();
  for (const g of grouped) {
    const t = tally.get(g.questionId) ?? { right: 0, total: 0 };
    t.total += g._count._all;
    if (g.isCorrect) t.right += g._count._all;
    tally.set(g.questionId, t);
  }
  const stats: QuestionStat[] = [];
  for (const q of questions) {
    const t = tally.get(q.id);
    if (!t || t.total < MIN_QUESTION_ANSWERS) continue;
    stats.push({ course: q.exam.courseModule?.course.title ?? "", module: q.exam.courseModule?.title ?? "", text: q.text, answered: t.total, correctPct: Math.round((t.right / t.total) * 100) });
  }

  return {
    generatedAt: new Date().toISOString(),
    periodDays,
    analytics: {
      registeredUsers: overview?.overview.registeredUsers ?? null,
      newRegistrations: overview?.overview.newRegistrations ?? null,
      currentlyActive: overview?.overview.currentlyActive ?? null,
      enrollments: overview?.overview.enrollments ?? 0,
      completions: overview?.overview.completions ?? 0,
      conversionRate: overview?.overview.conversionRate ?? null,
      funnel: overview?.funnel ?? [],
      topCourses: (content?.courses ?? []).slice(0, 8).map((c) => ({ title: c.title, views: c.views + c.anonymousViews, enrollments: c.enrollments, completionRate: c.completionRate })),
      insights: (insights?.insights ?? []).map((i) => i.summary).slice(0, 8),
      zeroResultSearches: (search?.zeroResultQueries ?? []).slice(0, 8),
      topSearches: (search?.topQueries ?? []).slice(0, 8),
    },
    courses: health,
    hardQuestions: stats.filter((s) => s.correctPct <= HARD_QUESTION_PCT).sort((a, b) => a.correctPct - b.correctPct).slice(0, 8),
    easyQuestions: stats.filter((s) => s.correctPct >= EASY_QUESTION_PCT).sort((a, b) => b.answered - a.answered).slice(0, 5),
  };
}
