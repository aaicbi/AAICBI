import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanQuiz, itemSignature, matchObjectives, parseContentFile, planImport, spreadPicks, textSimilarity, type ContentFile } from "@/lib/quest/contentImport";

const real = JSON.parse(readFileSync("content/ai-automation/module-1.json", "utf8"));

describe("the Module 1 content file", () => {
  it("passes the platform's own rules for every item", () => {
    const parsed = parseContentFile(real);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const plan = planImport(parsed.file, [], new Set());
    expect(plan.totals.quiz.invalid + plan.totals.matching.invalid + plan.totals.ordering.invalid + plan.totals.scenario.invalid).toBe(0);
    expect(plan.totals.quiz.create).toBe(160);
    expect(plan.totals.scenario.create).toBe(160);
    expect(plan.totals.matching.create + plan.totals.ordering.create).toBe(155 + 123);
    expect(plan.objectives).toHaveLength(8);
  });

  it("imports nothing twice", () => {
    const parsed = parseContentFile(real);
    if (!parsed.ok) throw new Error("bad file");
    const first = planImport(parsed.file, [], new Set());
    const known = new Set<string>();
    for (const o of parsed.file.objectives) {
      for (const k of ["quiz", "matching", "ordering", "scenario"] as const) for (const item of o[k]) known.add(itemSignature(k, item));
    }
    const again = planImport(parsed.file, [], known);
    expect(again.totals.quiz.create + again.totals.matching.create + again.totals.ordering.create + again.totals.scenario.create).toBe(0);
    expect(again.totals.quiz.duplicate).toBe(first.totals.quiz.create);
  });
});

describe("parseContentFile", () => {
  it("refuses a file with no objectives or a missing list", () => {
    expect(parseContentFile({}).ok).toBe(false);
    expect(parseContentFile({ objectives: [] }).ok).toBe(false);
    expect(parseContentFile({ objectives: [{ text: "x", quiz: [] }] }).ok).toBe(false);
    expect(parseContentFile(null).ok).toBe(false);
  });
});

describe("matchObjectives", () => {
  const file = { course: "c", module: "m", objectives: ["Explain what automation is", "Describe triggers and actions", "Brand new idea about ducks"].map((text, i) => ({ number: i + 1, text, quiz: [], matching: [], ordering: [], scenario: [] })) } as ContentFile;
  it("lines up identical, then similar text, once each", () => {
    const m = matchObjectives(file, [
      { id: "a", text: "Explain what automation is.", order: 0 },
      { id: "b", text: "Describe what triggers and actions are", order: 1 },
    ]);
    expect(m[0]).toMatchObject({ how: "same text" });
    expect(m[0].existing?.id).toBe("a");
    expect(m[1]).toMatchObject({ how: "similar text" });
    expect(m[1].existing?.id).toBe("b");
    expect(m[2].how).toBe("new");
  });
  it("never uses one existing objective for two", () => {
    const m = matchObjectives(file, [{ id: "a", text: "Explain what automation is", order: 0 }]);
    expect(m.filter((x) => x.existing).length).toBe(1);
  });
  it("scores similarity between 0 and 1", () => {
    expect(textSimilarity("a b c", "x y z")).toBe(0);
    expect(textSimilarity("explain what automation is", "explain what automation is")).toBe(1);
  });
});

describe("cleanQuiz", () => {
  it("accepts a good question and rejects broken ones", () => {
    expect(cleanQuiz({ question: "What starts a Zap?", options: ["A trigger", "An action"], correct: 0 }).ok).toBe(true);
    expect(cleanQuiz({ question: "What starts a Zap?", options: ["A trigger", "A trigger"], correct: 0 }).ok).toBe(false);
    expect(cleanQuiz({ question: "What starts a Zap?", options: ["A trigger", "An action"], correct: 5 }).ok).toBe(false);
    expect(cleanQuiz({ question: "?", options: ["a", "b"], correct: 0 }).ok).toBe(false);
  });
});

describe("setting questions aside for the assessment", () => {
  it("spreads the picks evenly and never takes more than asked", () => {
    expect(spreadPicks(20, 6)).toEqual([0, 3, 6, 10, 13, 16]);
    expect(spreadPicks(4, 6)).toHaveLength(4);
    expect(spreadPicks(20, 0)).toEqual([]);
  });

  it("marks that many quiz questions per objective for the assessment and the rest for games and practice", () => {
    const parsed = parseContentFile(real);
    if (!parsed.ok) throw new Error("bad file");
    const plan = planImport(parsed.file, [], new Set(), { reserve: 6 });
    for (const o of plan.objectives) {
      expect(o.quiz.filter((q) => q.pool === "FORMAL")).toHaveLength(6);
      expect(o.quiz.filter((q) => q.pool === "PRACTICE")).toHaveLength(14);
      expect(o.reserved).toBe(6);
    }
    const none = planImport(parsed.file, [], new Set());
    expect(none.objectives.every((o) => o.quiz.every((q) => q.pool === "PRACTICE"))).toBe(true);
  });

  it("never sets aside more than half of what is imported", () => {
    const parsed = parseContentFile(real);
    if (!parsed.ok) throw new Error("bad file");
    const small: ContentFile = { ...parsed.file, objectives: [{ ...parsed.file.objectives[0], quiz: parsed.file.objectives[0].quiz.slice(0, 4) }] };
    expect(planImport(small, [], new Set(), { reserve: 6 }).objectives[0].reserved).toBe(2);
  });
});

describe("choosing where each objective goes", () => {
  const file = { course: "c", module: "m", objectives: ["Explain what automation is", "Describe triggers and actions", "Explain no-code tools"].map((text, i) => ({ number: i + 1, text, quiz: [], matching: [], ordering: [], scenario: [] })) } as ContentFile;
  const existing = [
    { id: "a", text: "Understand automation", order: 0 },
    { id: "b", text: "Know the parts of a Zap", order: 1 },
  ];
  it("a person's choice wins over the automatic lining up", () => {
    const m = matchObjectives(file, existing, 0.7, { 0: "b", 1: "a", 2: "skip" });
    expect(m[0].existing?.id).toBe("b");
    expect(m[0].how).toBe("chosen");
    expect(m[1].existing?.id).toBe("a");
    expect(m[2].how).toBe("skipped");
  });
  it("lets a person force an objective to be added as new", () => {
    const same = [{ id: "a", text: "Explain what automation is", order: 0 }];
    expect(matchObjectives(file, same, 0.7, { 0: "new" })[0].how).toBe("new");
  });
  it("ignores a choice that points at nothing and falls back to automatic", () => {
    const same = [{ id: "a", text: "Explain what automation is", order: 0 }];
    expect(matchObjectives(file, same, 0.7, { 0: "ghost" })[0].existing?.id).toBe("a");
  });
  it("leaves a skipped objective's content out of the plan", () => {
    const parsed = parseContentFile(real);
    if (!parsed.ok) throw new Error("bad file");
    const plan = planImport(parsed.file, [], new Set(), { choices: { 0: "skip" } });
    expect(plan.objectives[0].quiz).toHaveLength(0);
    expect(plan.objectives[0].skipped).toBe(true);
    expect(plan.totals.quiz.create).toBe(140);
  });
});
