import { describe, expect, it } from "vitest";
import { BROADCAST_CONFIRM_THRESHOLD, clampLevel, decideExecution, titleFromMessage } from "@/lib/loop/policy";

describe("decideExecution", () => {
  it("level 1 asks for everything", () => {
    expect(decideExecution({ level: 1, risk: "low" })).toBe("ask");
    expect(decideExecution({ level: 1, risk: "high" })).toBe("ask");
  });
  it("level 2 runs low-risk changes and asks for risky ones", () => {
    expect(decideExecution({ level: 2, risk: "low" })).toBe("run");
    expect(decideExecution({ level: 2, risk: "high" })).toBe("ask");
  });
  it("level 3 runs everything except what must always be confirmed", () => {
    expect(decideExecution({ level: 3, risk: "high" })).toBe("run");
    expect(decideExecution({ level: 3, risk: "high", alwaysConfirm: true })).toBe("ask");
    expect(decideExecution({ level: 2, risk: "low", alwaysConfirm: true })).toBe("ask");
  });
  it("has a sensible confirmation threshold", () => {
    expect(BROADCAST_CONFIRM_THRESHOLD).toBeGreaterThan(1);
  });
});

describe("clampLevel", () => {
  it("accepts 1 to 3 and falls back to 1", () => {
    expect([clampLevel(1), clampLevel(2), clampLevel(3)]).toEqual([1, 2, 3]);
    expect(clampLevel(7)).toBe(1);
    expect(clampLevel("3")).toBe(3);
    expect(clampLevel(undefined)).toBe(1);
    expect(clampLevel(2.4)).toBe(2);
  });
});

describe("titleFromMessage", () => {
  it("uses the first words, one line, trimmed", () => {
    expect(titleFromMessage("  Hello\n\nthere  ")).toBe("Hello there");
    expect(titleFromMessage("x".repeat(100)).length).toBeLessThanOrEqual(46);
    expect(titleFromMessage("   ")).toBe("New chat");
  });
});
