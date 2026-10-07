import { describe, expect, it } from "vitest";
import { matchesSkill } from "@/lib/ecosystem/orgDiscovery";

describe("matchesSkill", () => {
  it("matches everything when the query is empty", () => {
    expect(matchesSkill([], "")).toBe(true);
    expect(matchesSkill(["SQL"], "   ")).toBe(true);
  });
  it("matches case-insensitively and by part of a skill", () => {
    expect(matchesSkill(["Data Analytics", "SQL"], "analytics")).toBe(true);
    expect(matchesSkill(["Python"], "PYTH")).toBe(true);
  });
  it("does not match skills the organization does not teach", () => {
    expect(matchesSkill(["SQL"], "react")).toBe(false);
    expect(matchesSkill([], "sql")).toBe(false);
  });
});
