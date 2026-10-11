/**
 * Watching the platform's health, with no AI and no database in this file.
 * A snapshot of aggregate numbers (analytics, lesson materials, assessments,
 * performance) is turned into a short list of signals a human can act on.
 * Signals are plain rules with named thresholds, so they cost nothing to
 * compute, can be shown at any time, and are the same facts the Claude
 * consultant is asked to explain. Everything here is aggregate: no trainee
 * is named or identifiable.
 */
export type SignalArea = "analytics" | "materials" | "assessments" | "performance";
export type Severity = "info" | "watch" | "action";

export interface ModuleStat {
  title: string;
  hasAssessment: boolean;
  totalAttempts: number;
  averagePercentage: number | null;
  passRate: number | null;
}

export interface CourseHealth {
  id: string;
  title: string;
  modules: number;
  lessons: number;
  materials: number;
  materialTypes: Record<string, number>;
  modulesWithoutLessons: number;
  lessonsWithoutMaterials: number;
  modulesWithoutAssessment: number;
  hasPublishedExam: boolean;
  trainees: number;
  averageCompletionPct: number | null;
  averageAssessmentScore: number | null;
  atRiskCount: number;
  certificationRate: number | null;
  moduleStats: ModuleStat[];
}

export interface QuestionStat {
  course: string;
  module: string;
  text: string;
  answered: number;
  correctPct: number;
}

export interface Snapshot {
  generatedAt: string;
  periodDays: number;
  analytics: {
    registeredUsers: number | null;
    newRegistrations: number | null;
    currentlyActive: number | null;
    enrollments: number;
    completions: number;
    conversionRate: number | null;
    funnel: Array<{ label: string; count: number; percentOfPrevious: number | null }>;
    topCourses: Array<{ title: string; views: number; enrollments: number; completionRate: number | null }>;
    insights: string[];
    zeroResultSearches: Array<{ query: string; count: number }>;
    topSearches: Array<{ query: string; count: number }>;
  };
  courses: CourseHealth[];
  hardQuestions: QuestionStat[];
  easyQuestions: QuestionStat[];
}

export interface Signal {
  area: SignalArea;
  severity: Severity;
  title: string;
  detail: string;
  /** Where to look, a page on this site. */
  href?: string;
}

// Named thresholds, not settings: the same trim as the analytics insights.
export const MIN_ATTEMPTS_FOR_PASS_RATE = 5;
export const LOW_PASS_RATE = 40;
export const VERY_HIGH_PASS_RATE = 95;
export const MIN_ATTEMPTS_FOR_TOO_EASY = 10;
export const LOW_COMPLETION_PCT = 30;
export const MIN_TRAINEES_FOR_COMPLETION = 5;
export const AT_RISK_SHARE = 0.25;
export const MIN_QUESTION_ANSWERS = 10;
export const HARD_QUESTION_PCT = 25;
export const EASY_QUESTION_PCT = 98;
export const ZERO_RESULT_MIN = 3;

const SEVERITY_ORDER: Record<Severity, number> = { action: 0, watch: 1, info: 2 };

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/** Turns a snapshot into signals, most important first. */
export function deriveSignals(s: Snapshot): Signal[] {
  const out: Signal[] = [];
  const push = (x: Signal) => out.push(x);

  // ---- lesson materials
  for (const c of s.courses) {
    const href = `/admin/courses/${c.id}`;
    if (c.modules === 0) {
      push({ area: "materials", severity: "action", title: `${c.title}: published with no modules`, detail: "Trainees who enrol find nothing to learn.", href });
      continue;
    }
    if (c.modulesWithoutLessons > 0) push({ area: "materials", severity: "action", title: `${c.title}: ${plural(c.modulesWithoutLessons, "module")} with no lessons`, detail: "Empty modules cannot be completed.", href });
    if (c.lessonsWithoutMaterials > 0) push({ area: "materials", severity: "watch", title: `${c.title}: ${plural(c.lessonsWithoutMaterials, "lesson")} with no materials`, detail: "A lesson with nothing attached gives trainees nothing to study.", href });
    if (c.modulesWithoutAssessment > 0 && c.modules > 0) push({ area: "materials", severity: "info", title: `${c.title}: ${plural(c.modulesWithoutAssessment, "module")} without an assessment`, detail: "Fine if intended; trainees cannot be checked on these modules.", href });
    if (c.materials > 0) {
      const videoOnly = Object.keys(c.materialTypes).every((t) => t === "VIDEO");
      if (videoOnly) push({ area: "materials", severity: "info", title: `${c.title}: videos only`, detail: "No readable notes or slides to accompany the videos; trainees who prefer reading or have low data have nothing else.", href });
    }
    if (!c.hasPublishedExam && c.trainees >= MIN_TRAINEES_FOR_COMPLETION) push({ area: "assessments", severity: "info", title: `${c.title}: no published course examination`, detail: "Trainees cannot earn a certificate without one.", href: `${href}/examination` });
  }

  // ---- assessments
  for (const c of s.courses) {
    for (const m of c.moduleStats) {
      if (!m.hasAssessment) continue;
      if (m.passRate !== null && m.totalAttempts >= MIN_ATTEMPTS_FOR_PASS_RATE && m.passRate < LOW_PASS_RATE) {
        push({ area: "assessments", severity: "action", title: `${c.title} · ${m.title}: only ${m.passRate}% pass`, detail: `${plural(m.totalAttempts, "attempt")}, average ${m.averagePercentage ?? "n/a"}%. Either the material, the questions or the pass mark may need a look.`, href: `/admin/courses/${c.id}` });
      } else if (m.passRate !== null && m.totalAttempts >= MIN_ATTEMPTS_FOR_TOO_EASY && m.passRate >= VERY_HIGH_PASS_RATE) {
        push({ area: "assessments", severity: "watch", title: `${c.title} · ${m.title}: ${m.passRate}% pass`, detail: `${plural(m.totalAttempts, "attempt")}. It may be too easy to tell trainees apart.`, href: `/admin/courses/${c.id}` });
      }
    }
  }
  for (const q of s.hardQuestions) push({ area: "assessments", severity: "watch", title: `${q.course} · ${q.module}: a question only ${q.correctPct}% get right`, detail: `"${q.text}" (${plural(q.answered, "answer")}). A wrong key, an unclear question or a gap in the lesson are all possible.`, href: undefined });
  for (const q of s.easyQuestions) push({ area: "assessments", severity: "info", title: `${q.course} · ${q.module}: a question ${q.correctPct}% get right`, detail: `"${q.text}" (${plural(q.answered, "answer")}). It may not be testing anything.` });

  // ---- performance
  for (const c of s.courses) {
    const href = `/admin/performance`;
    if (c.trainees >= MIN_TRAINEES_FOR_COMPLETION && c.averageCompletionPct !== null && c.averageCompletionPct < LOW_COMPLETION_PCT) {
      push({ area: "performance", severity: "watch", title: `${c.title}: average completion ${c.averageCompletionPct}%`, detail: `${plural(c.trainees, "trainee")} enrolled; most are not getting through.`, href });
    }
    if (c.trainees >= MIN_TRAINEES_FOR_COMPLETION && c.atRiskCount / c.trainees >= AT_RISK_SHARE) {
      push({ area: "performance", severity: "action", title: `${c.title}: ${c.atRiskCount} of ${c.trainees} trainees at risk`, detail: "A large share has gone quiet or is failing. A message or a change to the course may help.", href });
    }
  }

  // ---- analytics
  const a = s.analytics;
  const reg = a.funnel.find((f) => /regist/i.test(f.label));
  for (const f of a.funnel) {
    if (f.percentOfPrevious !== null && f.percentOfPrevious < 20 && f !== a.funnel[0] && (reg?.count ?? 0) >= 10) push({ area: "analytics", severity: "watch", title: `Funnel: only ${f.percentOfPrevious}% reach "${f.label}"`, detail: "The biggest drop in the journey this period.", href: "/admin/analytics" });
  }
  for (const i of a.insights) push({ area: "analytics", severity: "info", title: i, detail: "An automated insight from the analytics dashboard.", href: "/admin/analytics" });
  for (const q of a.zeroResultSearches.filter((x) => x.count >= ZERO_RESULT_MIN)) push({ area: "analytics", severity: "watch", title: `People searched for "${q.query}" ${q.count} times and found nothing`, detail: "Real demand for something that does not exist yet.", href: "/admin/analytics" });

  return out.sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]);
}

const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

/** The facts sent to Claude: the snapshot's numbers and the derived signals, aggregate only, capped. */
export function snapshotContext(s: Snapshot, signals: Signal[]): string {
  const a = s.analytics;
  const lines: string[] = [];
  lines.push(`PERIOD: last ${s.periodDays} days (generated ${s.generatedAt.slice(0, 10)})`);
  lines.push(`ANALYTICS: registered ${a.registeredUsers ?? "n/a"}, new ${a.newRegistrations ?? "n/a"}, active ${a.currentlyActive ?? "n/a"}, enrolments ${a.enrollments}, completions ${a.completions}, completion conversion ${a.conversionRate ?? "n/a"}%`);
  lines.push(`FUNNEL: ${a.funnel.map((f) => `${f.label} ${f.count}${f.percentOfPrevious !== null ? ` (${f.percentOfPrevious}% of previous)` : ""}`).join(" → ") || "no data"}`);
  lines.push(`TOP COURSES BY VIEWS: ${a.topCourses.slice(0, 8).map((c) => `${clip(c.title, 60)} (views ${c.views}, enrolments ${c.enrollments}, completion ${c.completionRate ?? "n/a"}%)`).join("; ") || "no data"}`);
  lines.push(`SEARCHES WITH NO RESULT: ${a.zeroResultSearches.slice(0, 8).map((q) => `"${clip(q.query, 50)}" x${q.count}`).join("; ") || "none"}`);
  lines.push(`TOP SEARCHES: ${a.topSearches.slice(0, 8).map((q) => `"${clip(q.query, 50)}" x${q.count}`).join("; ") || "none"}`);
  lines.push("", "PUBLISHED COURSES:");
  for (const c of s.courses.slice(0, 25)) {
    const mods = c.moduleStats.filter((m) => m.hasAssessment).map((m) => `${clip(m.title, 40)}: attempts ${m.totalAttempts}, avg ${m.averagePercentage ?? "n/a"}%, pass ${m.passRate ?? "n/a"}%`).join(" | ");
    lines.push(`- ${clip(c.title, 70)}: ${c.modules} modules, ${c.lessons} lessons, ${c.materials} materials (${Object.entries(c.materialTypes).map(([t, n]) => `${t} ${n}`).join(", ") || "none"}); ${c.trainees} trainees, completion ${c.averageCompletionPct ?? "n/a"}%, avg score ${c.averageAssessmentScore ?? "n/a"}%, at risk ${c.atRiskCount}, certified ${c.certificationRate ?? "n/a"}%; assessments: ${mods || "none"}`);
  }
  if (s.hardQuestions.length) lines.push("", "QUESTIONS MANY GET WRONG:", ...s.hardQuestions.slice(0, 8).map((q) => `- ${q.course} / ${q.module}: "${clip(q.text, 160)}" correct ${q.correctPct}% of ${q.answered}`));
  if (s.easyQuestions.length) lines.push("", "QUESTIONS NEARLY ALL GET RIGHT:", ...s.easyQuestions.slice(0, 5).map((q) => `- ${q.course} / ${q.module}: "${clip(q.text, 160)}" correct ${q.correctPct}% of ${q.answered}`));
  lines.push("", "SIGNALS ALREADY FLAGGED BY RULES:", ...(signals.slice(0, 40).map((x) => `- [${x.severity}] (${x.area}) ${clip(x.title, 160)}`) || ["none"]));
  return lines.join("\n");
}
