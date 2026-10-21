import { prisma } from "@/lib/prisma";
import { getModuleLockMap } from "@/lib/progress";
import { computeStreakDays } from "@/lib/analytics/streakCore";
import { activeDayKeys, engagementLevel, summarisePlays, summariseAttempts, type GameStats } from "./performanceCore";

export interface AttemptRow { courseTitle: string; assessment: string; kind: "Module assessment" | "Course examination" | "Standalone exam"; attemptNumber: number; startedAt: Date; submittedAt: Date | null; status: string; score: number | null; total: number | null; percentage: number | null; passMark: number | null; passed: boolean | null }
export interface AssessmentRow { courseTitle: string; assessment: string; attempts: number; best: number | null; latest: number | null; average: number | null; passed: boolean; attemptsToPass: number | null }
export interface ModuleRow { title: string; lessonsDone: number; lessonsTotal: number; completed: boolean; locked: boolean }
export interface CourseRow { id: string; title: string; enrolledAt: Date; completedAt: Date | null; accessEnded: boolean; modulesCompleted: number; modulesTotal: number; percent: number; lessonsDone: number; lessonsTotal: number; modules: ModuleRow[] }

export interface TraineeReport {
  generatedAt: Date;
  scopeNote: string;
  trainee: { id: string; name: string; email: string; phone: string | null; joinedAt: Date; lastLoginAt: Date | null };
  summary: { courses: number; coursesCompleted: number; modulesCompleted: number; lessonsDone: number; attempts: number; assessmentsPassed: number; averageScore: number | null; bestScore: number | null; certificates: number };
  courses: CourseRow[];
  assessments: AssessmentRow[];
  attempts: AttemptRow[];
  game: GameStats & { xp: number; practiceAttempts: number };
  platform: { level: string; lastActiveAt: Date | null; logins30: number; logins90: number; activeDays30: number; activeDays90: number; streakDays: number; coursesViewed: number; lessonsCompleted30: number; assessmentsStarted: number; loopQuestions: number };
  assignments: { title: string; submissions: number; best: number | null; latestStatus: string }[];
  certificates: { courseTitle: string; issuedAt: Date }[];
}

const DAY = 86400000;

/**
 * Everything about one trainee's performance. `courseIds` limits the course-linked sections (a training organization or instructor sees only
 * their own courses); platform activity and game play are always limited to those courses' modules when a scope is given, and the
 * login/activity figures are overall counts only, never a list of what the person did elsewhere.
 */
export async function getTraineeReport(traineeId: string, opts: { courseIds?: string[]; scopeNote?: string } = {}): Promise<TraineeReport | null> {
  const t = await prisma.trainee.findUnique({ where: { id: traineeId }, select: { id: true, name: true, email: true, phone: true, createdAt: true, lastLoginAt: true } });
  if (!t) return null;
  const scoped = opts.courseIds;
  const courseFilter = scoped ? { in: scoped } : undefined;
  const now = new Date();

  const enrollments = await prisma.courseEnrollment.findMany({
    where: { traineeId, ...(courseFilter ? { courseId: courseFilter } : {}) },
    orderBy: { enrolledAt: "desc" },
    select: { courseId: true, enrolledAt: true, completedAt: true, accessRevokedAt: true, course: { select: { title: true, modules: { orderBy: { order: "asc" }, select: { id: true, title: true, lessons: { select: { id: true } } } } } } },
  });
  const courseIds = enrollments.map((e) => e.courseId);
  const moduleIds = enrollments.flatMap((e) => e.course.modules.map((m) => m.id));

  const [done, attemptsRaw, plays, xp, events, loopCount, assignments, certs] = await Promise.all([
    prisma.lessonProgress.findMany({ where: { traineeId, lesson: { module: { courseId: { in: courseIds } } } }, select: { lessonId: true } }),
    prisma.attempt.findMany({
      where: { traineeId, OR: [{ exam: { moduleId: { in: moduleIds } } }, { exam: { courseId: { in: courseIds } } }, ...(scoped ? [] : [{ exam: { moduleId: null, courseId: null } }])] },
      orderBy: { startedAt: "asc" },
      select: { examId: true, attemptNumber: true, status: true, startedAt: true, submittedAt: true, score: true, totalQuestions: true, percentage: true, passed: true, passMarkPercent: true, exam: { select: { title: true, passMarkPercent: true, moduleId: true, courseId: true, courseModule: { select: { title: true, course: { select: { title: true } } } }, parentCourse: { select: { title: true } } } } },
    }),
    prisma.gamePlay.findMany({ where: { traineeId, moduleId: { in: moduleIds } }, select: { correct: true, secondsTaken: true, tooFast: true, answeredAt: true, moduleId: true, game: { select: { format: true } } } }),
    prisma.xpEntry.aggregate({ where: { traineeId, moduleId: { in: moduleIds } }, _sum: { points: true } }),
    prisma.analyticsEvent.findMany({ where: { userId: traineeId, recipientType: "TRAINEE", createdAt: { gte: new Date(now.getTime() - 90 * DAY) } }, select: { type: true, createdAt: true } }),
    prisma.aiCommandLog.count({ where: { askedByTraineeId: traineeId } }).catch(() => 0),
    prisma.assignmentSubmission.findMany({ where: { traineeId, OR: [{ assignment: { courseId: { in: courseIds } } }, { assignment: { module: { courseId: { in: courseIds } } } }] }, orderBy: { attemptNumber: "asc" }, select: { percentage: true, status: true, assignment: { select: { title: true, id: true } } } }),
    prisma.certificate.findMany({ where: { traineeId, revokedAt: null, ...(courseFilter ? { courseId: courseFilter } : {}) }, orderBy: { issuedAt: "desc" }, select: { issuedAt: true, course: { select: { title: true } } } }),
  ]);

  const doneSet = new Set(done.map((d) => d.lessonId));
  const courses: CourseRow[] = [];
  for (const e of enrollments) {
    const lock = await getModuleLockMap(e.courseId, traineeId).catch(() => ({}) as Awaited<ReturnType<typeof getModuleLockMap>>);
    const modules: ModuleRow[] = e.course.modules.map((m) => ({ title: m.title, lessonsTotal: m.lessons.length, lessonsDone: m.lessons.filter((l) => doneSet.has(l.id)).length, completed: !!lock[m.id]?.completed, locked: lock[m.id] ? !lock[m.id].unlocked : false }));
    const modulesCompleted = modules.filter((m) => m.completed).length;
    courses.push({ id: e.courseId, title: e.course.title, enrolledAt: e.enrolledAt, completedAt: e.completedAt, accessEnded: !!e.accessRevokedAt, modulesCompleted, modulesTotal: modules.length, percent: modules.length ? Math.round((modulesCompleted / modules.length) * 100) : 0, lessonsDone: modules.reduce((a, m) => a + m.lessonsDone, 0), lessonsTotal: modules.reduce((a, m) => a + m.lessonsTotal, 0), modules });
  }

  const attempts: AttemptRow[] = attemptsRaw.map((a) => ({
    courseTitle: a.exam.courseModule?.course.title ?? a.exam.parentCourse?.title ?? "Standalone",
    assessment: a.exam.courseModule ? `${a.exam.courseModule.title} — ${a.exam.title}` : a.exam.title,
    kind: a.exam.moduleId ? "Module assessment" : a.exam.courseId ? "Course examination" : "Standalone exam",
    attemptNumber: a.attemptNumber, startedAt: a.startedAt, submittedAt: a.submittedAt, status: a.status, score: a.score, total: a.totalQuestions, percentage: a.percentage, passMark: a.passMarkPercent ?? a.exam.passMarkPercent, passed: a.passed,
  }));
  const titleOf = new Map<string, { courseTitle: string; assessment: string }>();
  attempts.forEach((a, i) => titleOf.set(attemptsRaw[i].examId, { courseTitle: a.courseTitle, assessment: a.assessment }));
  const assessments: AssessmentRow[] = summariseAttempts(attemptsRaw.map((a) => ({ examKey: a.examId, attemptNumber: a.attemptNumber, percentage: a.percentage, passed: a.passed, submittedAt: a.submittedAt, startedAt: a.startedAt })))
    .map((s) => ({ ...titleOf.get(s.examKey)!, attempts: s.attempts, best: s.best, latest: s.latest, average: s.average, passed: s.passed, attemptsToPass: s.attemptsToPass }));
  const scored = attempts.filter((a) => a.submittedAt && a.percentage != null).map((a) => a.percentage as number);

  const game = summarisePlays(plays.map((p) => ({ correct: p.correct, secondsTaken: p.secondsTaken, tooFast: p.tooFast, answeredAt: p.answeredAt, format: p.game.format, moduleId: p.moduleId })));
  const eventDates = events.map((e) => e.createdAt);
  const activity = [...eventDates, ...plays.filter((p) => p.answeredAt).map((p) => p.answeredAt as Date)];
  const days = activeDayKeys(activity);
  const cutoff30 = new Date(now.getTime() - 30 * DAY).toISOString().slice(0, 10);
  const lastActive = activity.length ? new Date(Math.max(...activity.map((d) => d.getTime()), t.lastLoginAt?.getTime() ?? 0)) : t.lastLoginAt;
  const activeDays30 = days.filter((d) => d >= cutoff30).length;
  const count = (type: string, since?: number) => events.filter((e) => e.type === type && (!since || e.createdAt.getTime() >= since)).length;
  const since30 = now.getTime() - 30 * DAY;

  const byAssignment = new Map<string, { title: string; submissions: number; best: number | null; latestStatus: string }>();
  for (const s of assignments) { const cur = byAssignment.get(s.assignment.id) ?? { title: s.assignment.title, submissions: 0, best: null, latestStatus: s.status }; cur.submissions++; cur.latestStatus = s.status; if (s.percentage != null) cur.best = Math.max(cur.best ?? 0, Math.round(s.percentage)); byAssignment.set(s.assignment.id, cur); }

  return {
    generatedAt: now,
    scopeNote: opts.scopeNote ?? "All of this trainee's activity on the platform.",
    trainee: { id: t.id, name: t.name, email: t.email, phone: t.phone, joinedAt: t.createdAt, lastLoginAt: t.lastLoginAt },
    summary: { courses: courses.length, coursesCompleted: courses.filter((c) => c.completedAt).length, modulesCompleted: courses.reduce((a, c) => a + c.modulesCompleted, 0), lessonsDone: courses.reduce((a, c) => a + c.lessonsDone, 0), attempts: attempts.filter((a) => a.submittedAt).length, assessmentsPassed: assessments.filter((a) => a.passed).length, averageScore: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null, bestScore: scored.length ? Math.round(Math.max(...scored)) : null, certificates: certs.length },
    courses, assessments, attempts,
    game: { ...game, xp: xp._sum.points ?? 0, practiceAttempts: game.played },
    platform: { level: engagementLevel(activeDays30, lastActive ? Math.floor((now.getTime() - lastActive.getTime()) / DAY) : null), lastActiveAt: lastActive ?? null, logins30: count("LOGIN", since30), logins90: count("LOGIN"), activeDays30, activeDays90: days.length, streakDays: computeStreakDays(activity), coursesViewed: count("COURSE_VIEWED", since30), lessonsCompleted30: count("LESSON_COMPLETED", since30), assessmentsStarted: count("ASSESSMENT_STARTED"), loopQuestions: loopCount },
    assignments: [...byAssignment.values()],
    certificates: certs.map((c) => ({ courseTitle: c.course.title, issuedAt: c.issuedAt })),
  };
}

export interface RosterRow { traineeId: string; name: string; email: string; courses: number; percent: number; attempts: number; passed: number; average: number | null; gamePlayed: number; gameAccuracy: number | null; lastActive: Date | null; level: string }

/** One summary line per trainee for a set of courses (an organization's or instructor's). */
export async function getRoster(courseIds: string[], q = ""): Promise<{ rows: RosterRow[]; reports: Map<string, TraineeReport> }> {
  const enr = await prisma.courseEnrollment.findMany({ where: { courseId: { in: courseIds }, ...(q ? { trainee: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } } : {}) }, select: { traineeId: true }, distinct: ["traineeId"], take: 200 });
  const reports = new Map<string, TraineeReport>();
  for (const id of enr.map((e) => e.traineeId)) { const r = await getTraineeReport(id, { courseIds }); if (r) reports.set(id, r); }
  const rows = [...reports.values()].map((r) => ({
    traineeId: r.trainee.id, name: r.trainee.name, email: r.trainee.email, courses: r.summary.courses,
    percent: r.courses.length ? Math.round(r.courses.reduce((a, c) => a + c.percent, 0) / r.courses.length) : 0,
    attempts: r.summary.attempts, passed: r.summary.assessmentsPassed, average: r.summary.averageScore, gamePlayed: r.game.played, gameAccuracy: r.game.accuracyPercent, lastActive: r.platform.lastActiveAt, level: r.platform.level,
  })).sort((a, b) => a.name.localeCompare(b.name));
  return { rows, reports };
}
