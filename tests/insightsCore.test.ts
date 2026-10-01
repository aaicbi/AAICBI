import { describe, it, expect } from "vitest";
import { pctChange, meetsReportingThreshold, computeComparisonWindows } from "../src/lib/analytics/insightsCore";

describe("pctChange", () => {
  it("computes a simple positive change", () => {
    expect(pctChange(23, 20)).toBe(15);
  });

  it("computes a simple negative change", () => {
    expect(pctChange(10, 20)).toBe(-50);
  });

  it("returns null when the previous value is zero — never an infinite/undefined change", () => {
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(0, 0)).toBeNull();
  });

  it("returns 0 for no change", () => {
    expect(pctChange(20, 20)).toBe(0);
  });
});

describe("meetsReportingThreshold", () => {
  it("rejects a change computed from a previous value below the minimum baseline", () => {
    // 1 -> 0 is technically "-100%" but from a meaninglessly small base.
    expect(meetsReportingThreshold(1, pctChange(0, 1), 5, 15)).toBe(false);
  });

  it("rejects a change below the minimum magnitude even with a solid baseline", () => {
    expect(meetsReportingThreshold(100, pctChange(105, 100), 5, 15)).toBe(false); // +5%, below the 15% floor
  });

  it("accepts a change that clears both the baseline and the magnitude floor", () => {
    expect(meetsReportingThreshold(20, pctChange(25, 20), 5, 15)).toBe(true); // +25%, baseline 20 >= 5
  });

  it("rejects a null change (e.g. from a zero previous value) regardless of baseline", () => {
    expect(meetsReportingThreshold(10, null, 5, 15)).toBe(false);
  });

  it("treats the magnitude floor as applying to the absolute value of the change", () => {
    expect(meetsReportingThreshold(20, pctChange(10, 20), 5, 15)).toBe(true); // -50%, |change| clears the floor
  });
});

describe("computeComparisonWindows", () => {
  it("produces a current window ending at now and a previous window of equal length immediately before it", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const { current, previous } = computeComparisonWindows(30, now);
    expect(current.end.toISOString()).toBe(now.toISOString());
    expect(current.start.toISOString()).toBe(new Date("2026-09-01T00:00:00Z").toISOString());
    expect(previous.end.toISOString()).toBe(current.start.toISOString());
    expect(previous.start.toISOString()).toBe(new Date("2026-08-02T00:00:00Z").toISOString());
  });

  it("produces equal-length windows for any days value", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const { current, previous } = computeComparisonWindows(7, now);
    const currentLengthMs = current.end.getTime() - current.start.getTime();
    const previousLengthMs = previous.end.getTime() - previous.start.getTime();
    expect(currentLengthMs).toBe(previousLengthMs);
  });
});
