/**
 * Analytics System Phase 1 — the query/orchestration layer behind
 * GET /api/admin/analytics (and partly reused by the trainee-facing
 * personal-activity endpoint). Deliberately leans on data that already
 * exists wherever possible (CourseEnrollment, Certificate, AiCommandLog,
 * ConversationMessage) rather than re-deriving it from AnalyticsEvent —
 * see this file's own per-function comments for which source each
 * number comes from, and src/lib/analytics/track.ts for why Loop usage
 * specifically reuses AiCommandLog instead of a duplicate event.
 *
 * `courseIds` threads through every function as the INSTRUCTOR-scoping
 * mechanism: undefined means platform-wide (SUPER_ADMIN/ADMIN), an
 * array scopes every course-attributable number to just those courses.
 * Platform-wide-only numbers (total registered users, Loop/messaging
 * usage — neither AiCommandLog nor ConversationMessage carries a
 * courseId) are simply omitted from the scoped view rather than shown
 * as a misleading zero — see getFeatureUsage and getPlatformOverview.
 */
import { prisma } from "@/lib/prisma";
import { classifyLifecycle, type LifecycleTag } from "@/lib/analytics/lifecycleCore";

export interface PeriodRange {
  start: Date;
  end: Date;
}

function inPeriod(field: string, period: PeriodRange) {
  return { [field]: { gte: period.start, lt: period.end } };
}

function pct(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export interface PlatformOverview {
  registeredUsers: number | null; // null when scoped to an instructor — not a meaningful per-instructor number
  newRegistrations: number | null;
  currentlyActive: number | null;
  enrollments: number;
  completions: number;
  conversionRate: number | null;
}

export async function getPlatformOverview(period: PeriodRange, courseIds?: string[]): Promise<PlatformOverview> {
  const courseFilter = courseIds ? { courseId: { in: courseIds } } : {};

  const [registeredUsers, newRegistrations, currentlyActive, enrollments, completions] = await Promise.all([
    courseIds ? Promise.resolve(null) : prisma.trainee.count(),
    courseIds ? Promise.resolve(null) : prisma.trainee.count({ where: inPeriod("createdAt", period) }),
    // "Currently active" reads Trainee.lastLoginAt (a real field that
    // already existed before this feature) rather than AnalyticsEvent
    // LOGIN rows — it only has to answer "logged in within this
    // window," and the existing column already answers that without a
    // join, for every trainee, not just ones who've logged in since
    // this feature shipped.
    courseIds ? Promise.resolve(null) : prisma.trainee.count({ where: inPeriod("lastLoginAt", period) }),
    prisma.courseEnrollment.count({ where: { ...inPeriod("enrolledAt", period), ...courseFilter } }),
    prisma.courseEnrollment.count({ where: { ...inPeriod("completedAt", period), ...courseFilter } }),
  ]);

  return {
    registeredUsers,
    newRegistrations,
    currentlyActive,
    enrollments,
    completions,
    conversionRate: pct(completions, enrollments),
  };
}

export interface FunnelStage {
  label: string;
  count: number;
  percentOfPrevious: number | null;
}

/**
 * Registered → Enrolled → Started Learning → Completed, this period's
 * cohort only (not a cumulative, all-time funnel) — each stage counts
 * people who reached it DURING the selected window, which is the
 * honest, comparable-across-periods framing, not a claim about what
 * share of all-time registrants ever convert. "Started Learning" is the
 * first LESSON_COMPLETED or ASSESSMENT_STARTED AnalyticsEvent in the
 * window — the one funnel stage with no pre-existing equivalent field,
 * which is exactly the gap AnalyticsEvent exists to fill.
 *
 * Analytics System Phase 2 — now genuinely starts at "Visitors," not
 * "Registered": VisitorEvent (anonymous, opt-in) supplies the two new
 * leading stages. "Visitors" is platform-wide only (an anonymous
 * visitor isn't scoped to one instructor's courses the way a course
 * VIEW can be) — omitted, not shown as a misleading zero, for an
 * INSTRUCTOR's scoped funnel; "Viewed a Course" still works scoped,
 * since VisitorEvent.courseId can be filtered the same as everywhere
 * else in this file.
 */
export async function getConversionFunnel(period: PeriodRange, courseIds?: string[]): Promise<FunnelStage[]> {
  const courseFilter = courseIds ? { courseId: { in: courseIds } } : {};

  const visitors = courseIds
    ? null
    : (
        await prisma.visitorEvent.findMany({
          where: inPeriod("createdAt", period),
          select: { visitorId: true },
          distinct: ["visitorId"],
        })
      ).length;
  const viewedCourseRows = await prisma.visitorEvent.findMany({
    where: { type: "COURSE_VIEWED", ...inPeriod("createdAt", period), ...courseFilter },
    select: { visitorId: true },
    distinct: ["visitorId"],
  });
  const viewedCourse = viewedCourseRows.length;
  const registered = courseIds ? null : await prisma.trainee.count({ where: inPeriod("createdAt", period) });
  const enrolled = await prisma.courseEnrollment.count({ where: { ...inPeriod("enrolledAt", period), ...courseFilter } });
  const startedLearningRows = await prisma.analyticsEvent.findMany({
    where: { type: { in: ["LESSON_COMPLETED", "ASSESSMENT_STARTED"] }, ...inPeriod("createdAt", period), ...courseFilter },
    select: { userId: true },
    distinct: ["userId"],
  });
  const startedLearning = startedLearningRows.length;
  const completed = await prisma.courseEnrollment.count({ where: { ...inPeriod("completedAt", period), ...courseFilter } });

  const stages: FunnelStage[] = [];
  if (visitors !== null) {
    stages.push({ label: "Visitors", count: visitors, percentOfPrevious: null });
  }
  stages.push({ label: "Viewed a Course", count: viewedCourse, percentOfPrevious: visitors !== null ? pct(viewedCourse, visitors) : null });
  if (registered !== null) {
    stages.push({ label: "Registered", count: registered, percentOfPrevious: pct(registered, viewedCourse) });
  }
  stages.push({
    label: "Enrolled",
    count: enrolled,
    percentOfPrevious: registered !== null ? pct(enrolled, registered) : pct(enrolled, viewedCourse),
  });
  stages.push({ label: "Started Learning", count: startedLearning, percentOfPrevious: pct(startedLearning, enrolled) });
  stages.push({ label: "Completed", count: completed, percentOfPrevious: pct(completed, startedLearning) });
  return stages;
}

export interface CoursePerformanceRow {
  courseId: string;
  title: string;
  views: number;
  uniqueViewers: number;
  anonymousViews: number;
  enrollments: number;
  completions: number;
  completionRate: number | null;
}

/**
 * Per-course content performance for the selected period. One query
 * group per course rather than a single groupBy — simple and clear at
 * this platform's real current course count (a handful); worth
 * revisiting with batched groupBy queries if the catalog grows into the
 * hundreds.
 *
 * `anonymousViews` (Phase 2) counts distinct `VisitorEvent` visitorIds —
 * deliberately kept SEPARATE from `views`/`uniqueViewers` (which stay
 * exactly what they were in Phase 1: authenticated AnalyticsEvent rows)
 * rather than summed together, since a trainee who viewed a course both
 * anonymously and later while logged in would otherwise be silently
 * double-counted — there's no reliable way to link the two identities.
 */
export async function getCoursePerformance(period: PeriodRange, courseIds?: string[]): Promise<CoursePerformanceRow[]> {
  const courses = await prisma.course.findMany({
    where: courseIds ? { id: { in: courseIds } } : {},
    select: { id: true, title: true },
  });

  const rows: CoursePerformanceRow[] = [];
  for (const course of courses) {
    const [views, viewerRows, anonymousViewerRows, enrollments, completions] = await Promise.all([
      prisma.analyticsEvent.count({ where: { type: "COURSE_VIEWED", courseId: course.id, ...inPeriod("createdAt", period) } }),
      prisma.analyticsEvent.findMany({
        where: { type: "COURSE_VIEWED", courseId: course.id, ...inPeriod("createdAt", period) },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.visitorEvent.findMany({
        where: { type: "COURSE_VIEWED", courseId: course.id, ...inPeriod("createdAt", period) },
        select: { visitorId: true },
        distinct: ["visitorId"],
      }),
      prisma.courseEnrollment.count({ where: { courseId: course.id, ...inPeriod("enrolledAt", period) } }),
      prisma.courseEnrollment.count({ where: { courseId: course.id, ...inPeriod("completedAt", period) } }),
    ]);
    rows.push({
      courseId: course.id,
      title: course.title,
      views,
      uniqueViewers: viewerRows.length,
      anonymousViews: anonymousViewerRows.length,
      enrollments,
      completions,
      completionRate: pct(completions, enrollments),
    });
  }
  return rows.sort((a, b) => b.views - a.views);
}

export interface FeatureUsageRow {
  feature: string;
  totalUses: number;
  uniqueUsers: number;
}

/**
 * Feature usage for the selected period. Ask Loop (trainees) and
 * Messaging are platform-wide only — AiCommandLog and
 * ConversationMessage carry no courseId to scope by, so both are
 * omitted entirely for an INSTRUCTOR's scoped view rather than shown as
 * a misleading zero.
 */
export async function getFeatureUsage(period: PeriodRange, courseIds?: string[]): Promise<FeatureUsageRow[]> {
  const rows: FeatureUsageRow[] = [];

  if (!courseIds) {
    const [loopTotal, loopUniqueRows, messagesTotal, messagesUniqueRows] = await Promise.all([
      prisma.aiCommandLog.count({ where: { ...inPeriod("createdAt", period), askedByTraineeId: { not: null } } }),
      prisma.aiCommandLog.findMany({
        where: { ...inPeriod("createdAt", period), askedByTraineeId: { not: null } },
        select: { askedByTraineeId: true },
        distinct: ["askedByTraineeId"],
      }),
      prisma.conversationMessage.count({ where: inPeriod("createdAt", period) }),
      prisma.conversationMessage.findMany({ where: inPeriod("createdAt", period), select: { authorId: true }, distinct: ["authorId"] }),
    ]);
    rows.push(
      { feature: "Ask Loop (trainees)", totalUses: loopTotal, uniqueUsers: loopUniqueRows.length },
      { feature: "Messaging", totalUses: messagesTotal, uniqueUsers: messagesUniqueRows.length }
    );
  }

  const courseFilter = courseIds ? { courseId: { in: courseIds } } : {};
  const [certsTotal, certsUniqueRows] = await Promise.all([
    prisma.certificate.count({ where: { ...inPeriod("issuedAt", period), ...courseFilter } }),
    prisma.certificate.findMany({
      where: { ...inPeriod("issuedAt", period), ...courseFilter },
      select: { traineeId: true },
      distinct: ["traineeId"],
    }),
  ]);
  rows.push({ feature: "Certificates Issued", totalUses: certsTotal, uniqueUsers: certsUniqueRows.length });

  return rows;
}

export interface RegistrationTrendPoint {
  date: string; // YYYY-MM-DD
  registrations: number;
  enrollments: number;
}

/**
 * Daily registration/enrollment counts across the period — the one
 * Recharts LineChart on the dashboard. Registrations are platform-wide
 * only (a trainee doesn't "register into" a specific instructor's
 * course), so this returns enrollments-only series when scoped.
 */
export async function getRegistrationTrend(period: PeriodRange, courseIds?: string[]): Promise<RegistrationTrendPoint[]> {
  const courseFilter = courseIds ? { courseId: { in: courseIds } } : {};
  const [trainees, enrollments] = await Promise.all([
    courseIds ? Promise.resolve([]) : prisma.trainee.findMany({ where: inPeriod("createdAt", period), select: { createdAt: true } }),
    prisma.courseEnrollment.findMany({ where: { ...inPeriod("enrolledAt", period), ...courseFilter }, select: { enrolledAt: true } }),
  ]);

  const byDate = new Map<string, { registrations: number; enrollments: number }>();
  const bump = (date: Date, key: "registrations" | "enrollments") => {
    const day = date.toISOString().slice(0, 10);
    const entry = byDate.get(day) ?? { registrations: 0, enrollments: 0 };
    entry[key]++;
    byDate.set(day, entry);
  };
  trainees.forEach((t) => bump(t.createdAt, "registrations"));
  enrollments.forEach((e) => bump(e.enrolledAt, "enrollments"));

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}

/**
 * Platform-wide only (`null` when scoped to an instructor) — a
 * lifecycle tag is a fact about a TRAINEE, not about any one course, so
 * it has no honest per-instructor reading. Uses classifyLifecycle
 * (lifecycleCore.ts) against every trainee's current state — a
 * snapshot as of now, not scoped to the selected period, since "is this
 * trainee currently active" is inherently a point-in-time question.
 */
export async function getLifecycleBreakdown(courseIds?: string[]): Promise<Record<LifecycleTag, number> | null> {
  if (courseIds) return null;

  const [trainees, completedRows] = await Promise.all([
    prisma.trainee.findMany({ select: { id: true, createdAt: true, lastLoginAt: true } }),
    prisma.courseEnrollment.findMany({ where: { completedAt: { not: null } }, select: { traineeId: true }, distinct: ["traineeId"] }),
  ]);
  const completedTraineeIds = new Set(completedRows.map((r) => r.traineeId));

  const counts: Record<LifecycleTag, number> = { NEW: 0, ACTIVE: 0, INACTIVE: 0, COMPLETER: 0 };
  for (const trainee of trainees) {
    const tag = classifyLifecycle(trainee, completedTraineeIds.has(trainee.id));
    counts[tag]++;
  }
  return counts;
}

export interface CategoryCount {
  category: string;
  count: number;
}

/**
 * Analytics System Phase 2. Both platform-wide only (`null` when
 * scoped to an instructor) — traffic source and device category are
 * facts about an anonymous VISITOR, not about any one course, with the
 * same "no honest per-instructor reading" reasoning as
 * getLifecycleBreakdown above. Counts distinct VISITORS per category
 * (not raw event counts), so a visitor who views three pages in one
 * category isn't counted three times.
 */
export async function getTrafficSources(period: PeriodRange, courseIds?: string[]): Promise<CategoryCount[] | null> {
  if (courseIds) return null;
  // orderBy createdAt asc + distinct visitorId: the earliest event in
  // the period per visitor wins — the closest this simple query gets to
  // genuine first-touch attribution, rather than an arbitrary row.
  const rows = await prisma.visitorEvent.findMany({
    where: inPeriod("createdAt", period),
    select: { visitorId: true, referrerSource: true },
    orderBy: { createdAt: "asc" },
    distinct: ["visitorId"],
  });
  return tallyByCategory(rows.map((r) => r.referrerSource));
}

export async function getDeviceBreakdown(period: PeriodRange, courseIds?: string[]): Promise<CategoryCount[] | null> {
  if (courseIds) return null;
  const rows = await prisma.visitorEvent.findMany({
    where: inPeriod("createdAt", period),
    select: { visitorId: true, deviceCategory: true },
    orderBy: { createdAt: "asc" },
    distinct: ["visitorId"],
  });
  return tallyByCategory(rows.map((r) => r.deviceCategory));
}

function tallyByCategory(values: (string | null)[]): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([, a], [, b]) => b - a).map(([category, count]) => ({ category, count }));
}
