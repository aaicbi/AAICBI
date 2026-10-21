import { describe, expect, it } from "vitest";
import { activeDayKeys, engagementLevel, parseRecipients, summariseAttempts, summarisePlays, toCsv } from "@/lib/reports/performanceCore";

const d = (s: string) => new Date(s + "T10:00:00Z");

describe("summariseAttempts", () => {
  it("counts tries, best, latest and the try that passed", () => {
    const [s] = summariseAttempts([
      { examKey: "e", attemptNumber: 1, percentage: 60, passed: false, submittedAt: d("2026-01-01"), startedAt: d("2026-01-01") },
      { examKey: "e", attemptNumber: 3, percentage: 92, passed: true, submittedAt: d("2026-01-05"), startedAt: d("2026-01-05") },
      { examKey: "e", attemptNumber: 2, percentage: 72, passed: false, submittedAt: d("2026-01-03"), startedAt: d("2026-01-03") },
    ]);
    expect(s).toMatchObject({ attempts: 3, best: 92, latest: 92, average: 75, passed: true, attemptsToPass: 3 });
  });
  it("ignores unsubmitted attempts and reports not passed", () => {
    const r = summariseAttempts([
      { examKey: "e", attemptNumber: 1, percentage: null, passed: null, submittedAt: null, startedAt: d("2026-01-01") },
      { examKey: "e", attemptNumber: 2, percentage: 50, passed: false, submittedAt: d("2026-01-02"), startedAt: d("2026-01-02") },
    ]);
    expect(r[0]).toMatchObject({ attempts: 1, passed: false, attemptsToPass: null });
  });
  it("keeps assessments apart", () => {
    expect(summariseAttempts([
      { examKey: "a", attemptNumber: 1, percentage: 80, passed: true, submittedAt: d("2026-01-01"), startedAt: d("2026-01-01") },
      { examKey: "b", attemptNumber: 1, percentage: 40, passed: false, submittedAt: d("2026-01-01"), startedAt: d("2026-01-01") },
    ])).toHaveLength(2);
  });
});

describe("summarisePlays", () => {
  it("only counts answered items and splits by format", () => {
    const g = summarisePlays([
      { correct: true, secondsTaken: 10, tooFast: false, answeredAt: d("2026-01-01"), format: "QUIZ", moduleId: "m" },
      { correct: false, secondsTaken: 20, tooFast: true, answeredAt: d("2026-01-02"), format: "QUIZ", moduleId: "m" },
      { correct: true, secondsTaken: 6, tooFast: false, answeredAt: d("2026-01-02"), format: "MATCHING", moduleId: "m" },
      { correct: null, secondsTaken: null, tooFast: false, answeredAt: null, format: "QUIZ", moduleId: "m" },
    ]);
    expect(g).toMatchObject({ played: 3, correct: 2, accuracyPercent: 67, avgSeconds: 12, tooFast: 1, activeDays: 2 });
    expect(g.byFormat).toEqual([{ format: "MATCHING", played: 1, accuracyPercent: 100 }, { format: "QUIZ", played: 2, accuracyPercent: 50 }]);
  });
  it("is empty and safe with no plays", () => {
    expect(summarisePlays([])).toMatchObject({ played: 0, accuracyPercent: null, avgSeconds: null, lastPlayedAt: null });
  });
});

describe("engagementLevel", () => {
  it("grades by days active and recency", () => {
    expect(engagementLevel(15, 1)).toBe("High");
    expect(engagementLevel(5, 8)).toBe("Steady");
    expect(engagementLevel(1, 20)).toBe("Low");
    expect(engagementLevel(20, 40)).toBe("Inactive");
    expect(engagementLevel(0, null)).toBe("Inactive");
  });
});

describe("activeDayKeys", () => { it("de-duplicates days, newest first", () => expect(activeDayKeys([d("2026-01-01"), d("2026-01-03"), d("2026-01-01")])).toEqual(["2026-01-03", "2026-01-01"])); });

describe("toCsv", () => {
  it("quotes and defuses spreadsheet formulas", () => {
    expect(toCsv(["a", "b"], [['=SUM(A1)', 'x,"y"']])).toBe('a,b\r\n\'=SUM(A1),"x,""y"""\r\n');
  });
});

describe("parseRecipients", () => {
  it("accepts valid addresses, lower-cases and de-duplicates", () => {
    expect(parseRecipients("A@x.com, a@x.com; b@y.org")).toEqual({ ok: ["a@x.com", "b@y.org"], bad: [], tooMany: false });
  });
  it("reports invalid ones and caps at five", () => {
    expect(parseRecipients("nope, a@x.com").bad).toEqual(["nope"]);
    const many = parseRecipients("1@x.com 2@x.com 3@x.com 4@x.com 5@x.com 6@x.com");
    expect(many.ok).toHaveLength(5); expect(many.tooMany).toBe(true);
  });
});
