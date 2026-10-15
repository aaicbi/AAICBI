import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanQuiz, itemSignature, matchObjectives, parseContentFile, planImport, textSimilarity, type ContentFile } from "@/lib/quest/contentImport";

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
