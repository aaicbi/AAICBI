import { describe, it, expect } from "vitest";
import { checkReport, undoCounters, REPORTS_PER_HOUR, NOTE_MAX } from "@/lib/arena/moderationCore";

describe("reporting a match", () => {
  it("accepts a reason and tidies the note", () => {
    expect(checkReport({ reason: "CHEATING", note: "  they  shared\nanswers ", recentCount: 0 })).toEqual({ ok: true, reason: "CHEATING", note: "they shared answers" });
  });
  it("needs a known reason", () => {
    expect(checkReport({ reason: "banana", note: "", recentCount: 0 }).ok).toBe(false);
    expect(checkReport({ reason: undefined, note: "", recentCount: 0 }).ok).toBe(false);
  });
  it("asks for a few words when the reason is something else", () => {
    expect(checkReport({ reason: "OTHER", note: "", recentCount: 0 }).ok).toBe(false);
    expect(checkReport({ reason: "OTHER", note: "odd behaviour", recentCount: 0 }).ok).toBe(true);
  });
  it("limits how many reports one person can send in an hour", () => {
    expect(checkReport({ reason: "ABUSE", note: "", recentCount: REPORTS_PER_HOUR }).ok).toBe(false);
    expect(checkReport({ reason: "ABUSE", note: "", recentCount: REPORTS_PER_HOUR - 1 }).ok).toBe(true);
  });
  it("keeps a long note short", () => {
    const v = checkReport({ reason: "ABUSE", note: "x".repeat(1000), recentCount: 0 });
    expect(v.ok && v.note!.length).toBe(NOTE_MAX);
  });
});

describe("putting a result right", () => {
  it("takes back the right counter", () => {
    expect(undoCounters("WIN")).toEqual({ wins: 1, losses: 0, draws: 0 });
    expect(undoCounters("LOSS")).toEqual({ wins: 0, losses: 1, draws: 0 });
    expect(undoCounters("DRAW")).toEqual({ wins: 0, losses: 0, draws: 1 });
  });
});
