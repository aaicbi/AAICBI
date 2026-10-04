import { describe, it, expect } from "vitest";
import {
  computeAssignmentOverallStats,
  computeQuestionStats,
  aggregateLearningObjectiveStats,
  type SubmissionForAnalytics,
  type AnswerForQuestionAnalytics,
  type AnswerForLearningObjectiveStats,
} from "../src/lib/assignmentAnalytics";

describe("computeAssignmentOverallStats", () => {
  it("computes counts and averages from a mix of submissions", () => {
    const submissions: SubmissionForAnalytics[] = [
      { attemptNumber: 1, status: "AI_ASSESSED", percentage: 80 },
      { attemptNumber: 1, status: "AI_ASSESSED", percentage: 60 },
      { attemptNumber: 2, status: "INSTRUCTOR_REVIEWED", percentage: 90 },
      { attemptNumber: 1, status: "IN_PROGRESS", percentage: null },
      { attemptNumber: 1, status: "SUBMITTED", percentage: null },
    ];
    const stats = computeAssignmentOverallStats(submissions, 10);
    expect(stats.assignedCount).toBe(10);
    expect(stats.startedCount).toBe(5);
    expect(stats.submittedCount).toBe(4); // excludes the IN_PROGRESS one
    expect(stats.pendingReviewCount).toBe(1); // the plain SUBMITTED one
    expect(stats.averagePercentage).toBeCloseTo((80 + 60 + 90) / 3);
    expect(stats.highestPercentage).toBe(90);
    expect(stats.lowestPercentage).toBe(60);
    expect(stats.resubmissionRate).toBeCloseTo(1 / 5);
  });

  it("returns null averages and zero resubmission rate when nothing has been scored yet", () => {
    const stats = computeAssignmentOverallStats([], 5);
    expect(stats.averagePercentage).toBeNull();
    expect(stats.highestPercentage).toBeNull();
    expect(stats.lowestPercentage).toBeNull();
    expect(stats.resubmissionRate).toBe(0);
    expect(stats.startedCount).toBe(0);
  });
});

describe("computeQuestionStats", () => {
  it("buckets answers into correct (>=70%) vs needs improvement", () => {
    const answers: AnswerForQuestionAnalytics[] = [
      { questionId: "q1", score: 9, maxMarks: 10 }, // 90% - correct
      { questionId: "q1", score: 5, maxMarks: 10 }, // 50% - needs improvement
      { questionId: "q1", score: 7, maxMarks: 10 }, // 70% - correct (boundary)
    ];
    const stats = computeQuestionStats(answers, ["q1"]);
    expect(stats[0].gradedCount).toBe(3);
    expect(stats[0].answeredCorrectlyShare).toBeCloseTo(2 / 3);
    expect(stats[0].needsImprovementShare).toBeCloseTo(1 / 3);
    expect(stats[0].averagePercentage).toBeCloseTo((90 + 50 + 70) / 3);
  });

  it("includes a question with zero graded answers as 'not yet assessed' rather than omitting it", () => {
    const stats = computeQuestionStats([], ["q1", "q2"]);
    expect(stats).toHaveLength(2);
    expect(stats[0].averagePercentage).toBeNull();
    expect(stats[0].gradedCount).toBe(0);
  });

  it("ignores ungraded (null score) answers when computing a question's stats", () => {
    const answers: AnswerForQuestionAnalytics[] = [
      { questionId: "q1", score: null, maxMarks: 10 },
      { questionId: "q1", score: 8, maxMarks: 10 },
    ];
    const stats = computeQuestionStats(answers, ["q1"]);
    expect(stats[0].gradedCount).toBe(1);
  });
});

describe("aggregateLearningObjectiveStats", () => {
  it("groups scores by learning objective", () => {
    const answers: AnswerForLearningObjectiveStats[] = [
      { learningObjective: "Data Cleaning", score: 80 },
      { learningObjective: "Data Cleaning", score: 60 },
      { learningObjective: "SQL Basics", score: 90 },
    ];
    const stats = aggregateLearningObjectiveStats(answers);
    const dataCleaning = stats.find((s) => s.learningObjective === "Data Cleaning")!;
    expect(dataCleaning.count).toBe(2);
    expect(dataCleaning.totalPercentage).toBe(140);
    const sql = stats.find((s) => s.learningObjective === "SQL Basics")!;
    expect(sql.count).toBe(1);
  });

  it("buckets a null/empty learning objective under 'General' rather than dropping it", () => {
    const answers: AnswerForLearningObjectiveStats[] = [
      { learningObjective: null, score: 70 },
      { learningObjective: "  ", score: 50 },
    ];
    const stats = aggregateLearningObjectiveStats(answers);
    expect(stats).toHaveLength(1);
    expect(stats[0].learningObjective).toBe("General");
    expect(stats[0].count).toBe(2);
  });
});
