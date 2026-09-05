import { describe, it, expect } from "vitest";
import { computeTopicStats, type TopicAnswer } from "@/lib/performanceCore";

// Every existing test gets `answered: true` added by default via this
// helper, so tests written before the M13 audit fix (answered/
// unanswered tracking) don't have to be rewritten wholesale — only the
// new tests below explicitly exercise `answered: false`.
function a(overrides: Partial<TopicAnswer> & { topic: string | null; isCorrect: boolean }): TopicAnswer {
  return { answered: true, ...overrides };
}

describe("computeTopicStats", () => {
  it("returns an empty array for no answers", () => {
    expect(computeTopicStats([])).toEqual([]);
  });

  it("groups correctly by topic", () => {
    const result = computeTopicStats([
      a({ topic: "Formulas", isCorrect: true }),
      a({ topic: "Formulas", isCorrect: false }),
      a({ topic: "Pivot Tables", isCorrect: true }),
    ]);
    expect(result).toEqual(
      expect.arrayContaining([
        { topic: "Formulas", correct: 1, total: 2, unanswered: 0 },
        { topic: "Pivot Tables", correct: 1, total: 1, unanswered: 0 },
      ])
    );
  });

  it("buckets null topics under General rather than dropping them", () => {
    const result = computeTopicStats([
      a({ topic: null, isCorrect: true }),
      a({ topic: null, isCorrect: false }),
    ]);
    expect(result).toEqual([{ topic: "General", correct: 1, total: 2, unanswered: 0 }]);
  });

  it("buckets an empty-string or whitespace-only topic under General too", () => {
    const result = computeTopicStats([a({ topic: "", isCorrect: true }), a({ topic: "   ", isCorrect: true })]);
    expect(result).toEqual([{ topic: "General", correct: 2, total: 2, unanswered: 0 }]);
  });

  it("counts an unanswered/incorrect question fully against its topic's total, not just correct", () => {
    // Simulates 3 questions in "Pivot Tables," only 1 answered correctly.
    const result = computeTopicStats([
      a({ topic: "Pivot Tables", isCorrect: true }),
      a({ topic: "Pivot Tables", isCorrect: false }),
      a({ topic: "Pivot Tables", isCorrect: false }),
    ]);
    expect(result).toEqual([{ topic: "Pivot Tables", correct: 1, total: 3, unanswered: 0 }]);
  });

  it("sorts by total descending", () => {
    const result = computeTopicStats([
      a({ topic: "Small", isCorrect: true }),
      a({ topic: "Big", isCorrect: true }),
      a({ topic: "Big", isCorrect: false }),
      a({ topic: "Big", isCorrect: true }),
    ]);
    expect(result.map((r) => r.topic)).toEqual(["Big", "Small"]);
  });

  it("trims whitespace around a real topic label", () => {
    const result = computeTopicStats([a({ topic: "  Formulas  ", isCorrect: true })]);
    expect(result[0].topic).toBe("Formulas");
  });

  // M13 audit fix: answered vs. unanswered tracking.
  it("tracks unanswered questions separately from wrongly-answered ones", () => {
    const result = computeTopicStats([
      { topic: "Pivot Tables", isCorrect: false, answered: true }, // genuinely wrong
      { topic: "Pivot Tables", isCorrect: false, answered: false }, // never attempted
      { topic: "Pivot Tables", isCorrect: false, answered: false }, // never attempted
    ]);
    expect(result).toEqual([{ topic: "Pivot Tables", correct: 0, total: 3, unanswered: 2 }]);
  });

  it("an unanswered question is never counted as correct", () => {
    const result = computeTopicStats([{ topic: "Formulas", isCorrect: false, answered: false }]);
    expect(result[0].correct).toBe(0);
  });

  it("unanswered count is 0 when every question in a topic was attempted", () => {
    const result = computeTopicStats([
      { topic: "Formulas", isCorrect: true, answered: true },
      { topic: "Formulas", isCorrect: false, answered: true },
    ]);
    expect(result[0].unanswered).toBe(0);
  });
});
