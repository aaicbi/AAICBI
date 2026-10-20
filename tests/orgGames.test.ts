import { describe, expect, it } from "vitest";
import { cleanReason, liveFlags, mayToggle, ABANDONED_AFTER_MS, ACTION_KINDS, ACTION_LABEL } from "@/lib/orggames/core";

describe("organization games rules", () => {
  it("requires a readable reason and trims it", () => {
    expect(cleanReason("")).toMatchObject({ ok: false });
    expect(cleanReason("  no  ")).toMatchObject({ ok: false });
    expect(cleanReason(42)).toMatchObject({ ok: false });
    expect(cleanReason("  Rude   chat  ")).toEqual({ ok: true, reason: "Rude chat" });
    const long = cleanReason("x".repeat(900));
    expect(long.ok && long.reason.length).toBe(300);
  });
  it("flags abandoned and reported matches", () => {
    const now = 10 * ABANDONED_AFTER_MS;
    expect(liveFlags({ status: "ACTIVE", startedAt: now - ABANDONED_AFTER_MS - 1, openReports: 0 }, now)).toEqual(["Possibly abandoned"]);
    expect(liveFlags({ status: "ACTIVE", startedAt: now - 1000, openReports: 2 }, now)).toEqual(["2 open reports"]);
    expect(liveFlags({ status: "DONE", startedAt: 0, openReports: 1 }, now)).toEqual(["1 open report"]);
  });
  it("lets an organization switch on only what is inherited as allowed", () => {
    expect(mayToggle("gameEnabled", true, { gameEnabled: true })).toEqual({ ok: true });
    expect(mayToggle("gameEnabled", true, { gameEnabled: false })).toMatchObject({ ok: false });
    expect(mayToggle("gameEnabled", false, { gameEnabled: false })).toEqual({ ok: true });
    expect(mayToggle("somethingElse", false, {})).toMatchObject({ ok: false });
  });
  it("labels every action kind", () => {
    for (const k of ACTION_KINDS) expect(ACTION_LABEL[k]).toBeTruthy();
  });
});
