import { describe, it, expect } from "vitest";
import { deriveSignals, snapshotContext, type CourseHealth, type Snapshot } from "@/lib/guide/monitorCore";

const course = (over: Partial<CourseHealth> = {}): CourseHealth => ({
  id: "c1", title: "Python Foundations", modules: 3, lessons: 6, materials: 9, materialTypes: { DOCX: 5, VIDEO: 4 }, modulesWithoutLessons: 0, lessonsWithoutMaterials: 0, modulesWithoutAssessment: 0,
  hasPublishedExam: true, trainees: 20, averageCompletionPct: 70, averageAssessmentScore: 72, atRiskCount: 2, certificationRate: 40,
  moduleStats: [{ title: "Basics", hasAssessment: true, totalAttempts: 30, averagePercentage: 70, passRate: 80 }], ...over,
});
const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  generatedAt: "2026-10-11T10:00:00.000Z", periodDays: 30,
  analytics: { registeredUsers: 200, newRegistrations: 20, currentlyActive: 50, enrollments: 40, completions: 10, conversionRate: 25, funnel: [{ label: "Registered", count: 100, percentOfPrevious: null }, { label: "Enrolled", count: 60, percentOfPrevious: 60 }], topCourses: [], insights: [], zeroResultSearches: [], topSearches: [] },
  courses: [course()], hardQuestions: [], easyQuestions: [], ...over,
});
const titles = (s: Snapshot) => deriveSignals(s).map((x) => x.title);

describe("monitoring signals", () => {
  it("says nothing about a healthy platform", () => {
    expect(deriveSignals(snap())).toEqual([]);
  });
  it("flags lesson materials that leave trainees with nothing", () => {
    const t = titles(snap({ courses: [course({ modulesWithoutLessons: 1, lessonsWithoutMaterials: 2, modulesWithoutAssessment: 1 })] }));
    expect(t.join("|")).toMatch(/1 module with no lessons/);
    expect(t.join("|")).toMatch(/2 lessons with no materials/);
    expect(t.join("|")).toMatch(/1 module without an assessment/);
    expect(titles(snap({ courses: [course({ modules: 0, lessons: 0, materials: 0, materialTypes: {} })] })).join("|")).toMatch(/published with no modules/);
    expect(titles(snap({ courses: [course({ materialTypes: { VIDEO: 4 } })] })).join("|")).toMatch(/videos only/);
  });
  it("flags assessments that are failing or too easy, only with enough attempts", () => {
    const low = (a: number, p: number) => snap({ courses: [course({ moduleStats: [{ title: "Hard", hasAssessment: true, totalAttempts: a, averagePercentage: 30, passRate: p }] })] });
    expect(titles(low(10, 20)).join("|")).toMatch(/only 20% pass/);
    expect(deriveSignals(low(3, 0))).toEqual([]);
    expect(titles(low(20, 99)).join("|")).toMatch(/99% pass/);
    expect(deriveSignals(low(6, 99))).toEqual([]);
  });
  it("flags questions most people get wrong or nearly everyone gets right", () => {
    const t = titles(snap({ hardQuestions: [{ course: "P", module: "M", text: "What is x?", answered: 40, correctPct: 12 }], easyQuestions: [{ course: "P", module: "M", text: "Is 1 one?", answered: 80, correctPct: 100 }] })).join("|");
    expect(t).toMatch(/only 12% get right/);
    expect(t).toMatch(/100% get right/);
  });
  it("flags weak completion and at-risk trainees only for courses with enough trainees", () => {
    const t = titles(snap({ courses: [course({ averageCompletionPct: 10, atRiskCount: 8 })] })).join("|");
    expect(t).toMatch(/average completion 10%/);
    expect(t).toMatch(/8 of 20 trainees at risk/);
    expect(deriveSignals(snap({ courses: [course({ trainees: 3, averageCompletionPct: 5, atRiskCount: 3 })] }))).toEqual([]);
  });
  it("flags searches that found nothing and big funnel drops", () => {
    const t = titles(snap({ analytics: { ...snap().analytics, zeroResultSearches: [{ query: "cloud security", count: 7 }, { query: "x", count: 1 }], funnel: [{ label: "Registered", count: 100, percentOfPrevious: null }, { label: "Enrolled", count: 10, percentOfPrevious: 10 }] } })).join("|");
    expect(t).toMatch(/"cloud security" 7 times/);
    expect(t).not.toMatch(/"x"/);
    expect(t).toMatch(/only 10% reach "Enrolled"/);
  });
  it("lists what needs action first", () => {
    const s = deriveSignals(snap({ courses: [course({ modulesWithoutAssessment: 1, modulesWithoutLessons: 1 })] }));
    expect(s[0].severity).toBe("action");
    expect(s[s.length - 1].severity).toBe("info");
  });
});

describe("what Claude is shown about the platform", () => {
  it("is aggregate: course and module names and numbers, never a person", () => {
    const ctx = snapshotContext(snap({ courses: [course()], hardQuestions: [{ course: "Python", module: "Basics", text: "What is a list?", answered: 30, correctPct: 20 }] }), []);
    expect(ctx).toMatch(/Python Foundations: 3 modules/);
    expect(ctx).toMatch(/QUESTIONS MANY GET WRONG/);
    expect(ctx).not.toMatch(/@|email|traineeId|userId/i);
  });
});
