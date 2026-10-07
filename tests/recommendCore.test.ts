import { describe, expect, it } from "vitest";
import { cleanSkillList, overlapCount, rankPrograms, scoreProgram, type ProgramCandidate, type VideoContext } from "@/lib/ecosystem/recommendCore";

const video: VideoContext = { skills: ["SQL", "Data Analytics"], category: "Data Analytics", courseId: null, organizationId: "orgA" };
const program = (over: Partial<ProgramCandidate>): ProgramCandidate => ({
  id: "p", title: "P", organizationId: "orgB", organizationName: "B", organizationSlug: "b", category: null, durationDisplay: null, skills: [], ...over,
});

describe("overlapCount", () => {
  it("ignores case and spacing and counts each skill once", () => {
    expect(overlapCount(["SQL", " python "], ["sql", "Python", "PYTHON", "Excel"])).toBe(2);
    expect(overlapCount([], ["sql"])).toBe(0);
  });
});

describe("scoreProgram", () => {
  it("is zero when nothing connects the program to the video", () => {
    expect(scoreProgram(video, program({ skills: ["Cooking"], category: "Food" }))).toBe(0);
  });
  it("rises with shared skills, category and an explicit tag", () => {
    const one = scoreProgram(video, program({ skills: ["sql"] }));
    const two = scoreProgram(video, program({ skills: ["sql", "data analytics"] }));
    const withCategory = scoreProgram(video, program({ skills: ["sql", "data analytics"], category: "data analytics" }));
    expect(two).toBeGreaterThan(one);
    expect(withCategory).toBeGreaterThan(two);
    const tagged = scoreProgram({ ...video, courseId: "p" }, program({ id: "p", skills: ["sql"] }));
    expect(tagged).toBeGreaterThan(withCategory);
  });
  it("gives the publishing organization only a small nudge", () => {
    const other = scoreProgram(video, program({ skills: ["sql"], organizationId: "orgB" }));
    const same = scoreProgram(video, program({ skills: ["sql"], organizationId: "orgA" }));
    expect(same - other).toBeLessThan(1);
    // A clearly more relevant program from another organization still wins.
    const better = scoreProgram(video, program({ skills: ["sql", "data analytics"], organizationId: "orgB" }));
    expect(better).toBeGreaterThan(same);
  });
});

describe("rankPrograms", () => {
  it("returns only relevant programs, best first, one per organization by default", () => {
    const list = [
      program({ id: "a1", title: "A1", organizationId: "orgA", skills: ["sql"] }),
      program({ id: "a2", title: "A2", organizationId: "orgA", skills: ["sql", "data analytics"] }),
      program({ id: "b1", title: "B1", organizationId: "orgB", skills: ["sql"] }),
      program({ id: "c1", title: "C1", organizationId: "orgC", skills: ["knitting"] }),
    ];
    expect(rankPrograms(video, list, 5).map((p) => p.id)).toEqual(["a2", "b1"]);
    expect(rankPrograms(video, list, 5, 2).map((p) => p.id)).toEqual(["a2", "a1", "b1"]);
    expect(rankPrograms(video, list, 1).map((p) => p.id)).toEqual(["a2"]);
  });
});

describe("cleanSkillList", () => {
  it("trims, collapses spaces, de-duplicates case-insensitively and caps", () => {
    expect(cleanSkillList([" Power  BI ", "power bi", "", "SQL"])).toEqual(["Power BI", "SQL"]);
    expect(cleanSkillList(Array.from({ length: 20 }, (_, i) => `s${i}`), 8)).toHaveLength(8);
    expect(cleanSkillList(["x".repeat(100)])[0]).toHaveLength(40);
  });
});
