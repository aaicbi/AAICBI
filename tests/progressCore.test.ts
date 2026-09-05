import { describe, it, expect } from "vitest";
import {
  computeModuleProgress,
  computeModuleCompletion,
  computeUnlockedFromCompletion,
  findNextModule,
  isCourseComplete,
  type ModuleProgressInput,
} from "@/lib/progressCore";

function mod(overrides: Partial<ModuleProgressInput> & { id: string; order: number }): ModuleProgressInput {
  return {
    totalLessons: 0,
    completedLessons: 0,
    hasPublishedAssessment: false,
    assessmentPassed: false,
    ...overrides,
  };
}

describe("computeModuleProgress", () => {
  it("returns an empty array for no modules", () => {
    expect(computeModuleProgress([])).toEqual([]);
  });

  it("always unlocks the first module regardless of its own completion", () => {
    const result = computeModuleProgress([mod({ id: "m1", order: 0, totalLessons: 3, completedLessons: 0 })]);
    expect(result).toEqual([{ id: "m1", completed: false, unlocked: true }]);
  });

  it("an empty module (no lessons, no assessment) auto-completes", () => {
    const result = computeModuleProgress([mod({ id: "m1", order: 0 })]);
    expect(result[0].completed).toBe(true);
  });

  it("a module with a published assessment is gated on passing it, not lesson completion", () => {
    const result = computeModuleProgress([
      mod({
        id: "m1",
        order: 0,
        totalLessons: 5,
        completedLessons: 0, // no lessons done
        hasPublishedAssessment: true,
        assessmentPassed: true, // but assessment passed
      }),
    ]);
    expect(result[0].completed).toBe(true);
  });

  it("a module with a published, unpassed assessment is not completed even with all lessons done", () => {
    const result = computeModuleProgress([
      mod({
        id: "m1",
        order: 0,
        totalLessons: 3,
        completedLessons: 3,
        hasPublishedAssessment: true,
        assessmentPassed: false,
      }),
    ]);
    expect(result[0].completed).toBe(false);
  });

  it("an unpublished assessment falls back to lesson-completion", () => {
    const result = computeModuleProgress([
      mod({
        id: "m1",
        order: 0,
        totalLessons: 2,
        completedLessons: 2,
        hasPublishedAssessment: false, // exam exists but not published — not modeled here, just absent
        assessmentPassed: false,
      }),
    ]);
    expect(result[0].completed).toBe(true);
  });

  it("a module with lessons is complete only once all are done", () => {
    const partial = computeModuleProgress([mod({ id: "m1", order: 0, totalLessons: 3, completedLessons: 2 })]);
    expect(partial[0].completed).toBe(false);

    const full = computeModuleProgress([mod({ id: "m1", order: 0, totalLessons: 3, completedLessons: 3 })]);
    expect(full[0].completed).toBe(true);
  });

  it("locks module 2 until module 1 is completed", () => {
    const result = computeModuleProgress([
      mod({ id: "m1", order: 0, totalLessons: 1, completedLessons: 0 }),
      mod({ id: "m2", order: 1, totalLessons: 1, completedLessons: 0 }),
    ]);
    expect(result.find((r) => r.id === "m1")).toMatchObject({ unlocked: true, completed: false });
    expect(result.find((r) => r.id === "m2")).toMatchObject({ unlocked: false });
  });

  it("unlocks module 2 once module 1 is completed", () => {
    const result = computeModuleProgress([
      mod({ id: "m1", order: 0, totalLessons: 1, completedLessons: 1 }),
      mod({ id: "m2", order: 1, totalLessons: 1, completedLessons: 0 }),
    ]);
    expect(result.find((r) => r.id === "m1")).toMatchObject({ completed: true, unlocked: true });
    expect(result.find((r) => r.id === "m2")).toMatchObject({ unlocked: true });
  });

  it("a chain of three modules locks the third if the second is incomplete, even if the first is complete", () => {
    const result = computeModuleProgress([
      mod({ id: "m1", order: 0, totalLessons: 1, completedLessons: 1 }),
      mod({ id: "m2", order: 1, totalLessons: 1, completedLessons: 0 }),
      mod({ id: "m3", order: 2, totalLessons: 1, completedLessons: 1 }),
    ]);
    expect(result.find((r) => r.id === "m1")).toMatchObject({ unlocked: true, completed: true });
    expect(result.find((r) => r.id === "m2")).toMatchObject({ unlocked: true, completed: false });
    expect(result.find((r) => r.id === "m3")).toMatchObject({ unlocked: false });
  });

  it("sorts by order regardless of input array order", () => {
    const result = computeModuleProgress([
      mod({ id: "m2", order: 1, totalLessons: 1, completedLessons: 0 }),
      mod({ id: "m1", order: 0, totalLessons: 1, completedLessons: 1 }),
    ]);
    expect(result.map((r) => r.id)).toEqual(["m1", "m2"]);
  });

  it("gaps in the order sequence don't create phantom locked modules", () => {
    // orders 0, 2, 5 — no modules at 1, 3, 4. Module at order=2 should
    // still just follow the module at order=0 in sequence.
    const result = computeModuleProgress([
      mod({ id: "m1", order: 0, totalLessons: 1, completedLessons: 1 }),
      mod({ id: "m2", order: 2, totalLessons: 1, completedLessons: 1 }),
      mod({ id: "m3", order: 5, totalLessons: 1, completedLessons: 0 }),
    ]);
    expect(result.find((r) => r.id === "m2")).toMatchObject({ unlocked: true, completed: true });
    expect(result.find((r) => r.id === "m3")).toMatchObject({ unlocked: true, completed: false });
  });
});

describe("computeModuleCompletion (M12 audit fix — the split-out per-module rule)", () => {
  it("matches computeModuleProgress's per-module completion exactly for every case above", () => {
    // Cross-check: the split functions must reproduce the combined
    // function's behavior exactly, since progress.ts now uses the
    // split versions directly (for the sticky-completion fix) while
    // computeModuleProgress itself is kept only for callers/tests that
    // don't need the split.
    const cases: ModuleProgressInput[] = [
      mod({ id: "a", order: 0 }),
      mod({ id: "b", order: 0, totalLessons: 3, completedLessons: 2 }),
      mod({ id: "c", order: 0, totalLessons: 3, completedLessons: 3 }),
      mod({ id: "d", order: 0, hasPublishedAssessment: true, assessmentPassed: false }),
      mod({ id: "e", order: 0, hasPublishedAssessment: true, assessmentPassed: true }),
    ];
    for (const c of cases) {
      expect(computeModuleCompletion(c)).toBe(computeModuleProgress([c])[0].completed);
    }
  });
});

describe("computeUnlockedFromCompletion (M12 audit fix — the split-out unlock chain)", () => {
  it("matches computeModuleProgress's unlock chain given the same completion values", () => {
    const modules = [
      { id: "m1", order: 0, completed: true },
      { id: "m2", order: 1, completed: false },
      { id: "m3", order: 2, completed: true },
    ];
    const result = computeUnlockedFromCompletion(modules);
    expect(result).toEqual([
      { id: "m1", completed: true, unlocked: true },
      { id: "m2", completed: false, unlocked: true },
      { id: "m3", completed: true, unlocked: false },
    ]);
  });

  it("always unlocks the first module regardless of its own completed value", () => {
    const result = computeUnlockedFromCompletion([{ id: "m1", order: 0, completed: false }]);
    expect(result[0].unlocked).toBe(true);
  });

  it("this is exactly how sticky completion re-locks nothing: a module marked completed here stays unlocked-granting even if the underlying rule would now say otherwise", () => {
    // Simulates progress.ts's sticky read: module 1 has a persisted
    // ModuleCompletion row, so its `completed` input here is `true`
    // regardless of what computeModuleCompletion would say about its
    // CURRENT data (e.g. an assessment published after the fact that
    // hasn't been passed yet). Module 2 must still be unlocked.
    const result = computeUnlockedFromCompletion([
      { id: "m1", order: 0, completed: true }, // sticky: true, even though live data might now say false
      { id: "m2", order: 1, completed: false },
    ]);
    expect(result.find((r) => r.id === "m2")?.unlocked).toBe(true);
  });
});

describe("findNextModule (M14 — the module worth notifying about)", () => {
  const modules = [
    { id: "m1", order: 0 },
    { id: "m2", order: 1 },
    { id: "m3", order: 2 },
  ];

  it("returns the module immediately after the completed one", () => {
    expect(findNextModule(modules, "m1")).toEqual({ id: "m2", order: 1 });
  });

  it("returns null when the completed module is the last one", () => {
    expect(findNextModule(modules, "m3")).toBeNull();
  });

  it("returns null when the completed module id isn't found at all", () => {
    expect(findNextModule(modules, "does-not-exist")).toBeNull();
  });

  it("skips order gaps correctly, same reasoning as the unlock chain", () => {
    const gappy = [
      { id: "m1", order: 0 },
      { id: "m2", order: 5 },
      { id: "m3", order: 9 },
    ];
    expect(findNextModule(gappy, "m1")).toEqual({ id: "m2", order: 5 });
  });

  it("returns the closest next module, not just any later one", () => {
    const unordered = [
      { id: "m3", order: 2 },
      { id: "m1", order: 0 },
      { id: "m2", order: 1 },
    ];
    expect(findNextModule(unordered, "m1")).toEqual({ id: "m2", order: 1 });
  });
});

describe("isCourseComplete (M15 — the certificate-issuance gate)", () => {
  it("returns false for a course with zero modules — nothing to have completed", () => {
    expect(isCourseComplete([])).toBe(false);
  });

  it("returns false when any module is incomplete", () => {
    expect(isCourseComplete([{ completed: true }, { completed: false }])).toBe(false);
  });

  it("returns true only when every module is complete", () => {
    expect(isCourseComplete([{ completed: true }, { completed: true }])).toBe(true);
  });

  it("returns true for a single completed module", () => {
    expect(isCourseComplete([{ completed: true }])).toBe(true);
  });
});
