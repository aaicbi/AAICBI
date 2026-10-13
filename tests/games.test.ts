import { describe, expect, it } from "vitest";
import { gradeItem, itemText, itemTitle, serveItem, validateItemContent, type ItemContent } from "@/lib/quest/games";

const identity = <T,>(a: readonly T[]) => [...a];
const reverse = <T,>(a: readonly T[]) => [...a].reverse();

const matching = { prompt: "Match", pairs: [{ left: "Trigger", right: "Starts a workflow" }, { left: "Action", right: "A step it performs" }, { left: "Filter", right: "Stops unwanted runs" }] };
const ordering = { prompt: "Order the workflow", steps: ["Pick a trigger", "Add a filter", "Add an action", "Test it"] };
const scenario = {
  situation: "A form submission did not create a CRM contact.",
  options: [
    { text: "Check the run history", outcome: "You find the failed step.", correct: true },
    { text: "Rebuild everything", outcome: "That loses time and the cause.", correct: false },
  ],
};

describe("validateItemContent", () => {
  it("accepts well-formed items and tidies whitespace", () => {
    const v = validateItemContent("MATCHING", { ...matching, pairs: matching.pairs.map((p) => ({ left: `  ${p.left}  `, right: p.right })) });
    expect(v.ok && (v.content as typeof matching).pairs[0].left).toBe("Trigger");
    expect(validateItemContent("ORDERING", ordering).ok).toBe(true);
    expect(validateItemContent("SCENARIO", scenario).ok).toBe(true);
  });
  it("rejects too few or duplicate pairs", () => {
    expect(validateItemContent("MATCHING", { pairs: matching.pairs.slice(0, 2) }).ok).toBe(false);
    expect(validateItemContent("MATCHING", { pairs: [...matching.pairs.slice(0, 2), { left: "Trigger", right: "Other" }] }).ok).toBe(false);
    expect(validateItemContent("MATCHING", { pairs: [...matching.pairs.slice(0, 2), { left: "Third", right: "A step it performs" }] }).ok).toBe(false);
  });
  it("rejects sequences without a prompt, with repeats, or out of range", () => {
    expect(validateItemContent("ORDERING", { steps: ordering.steps }).ok).toBe(false);
    expect(validateItemContent("ORDERING", { prompt: "x", steps: ["a", "b"] }).ok).toBe(false);
    expect(validateItemContent("ORDERING", { prompt: "x", steps: ["a", "b", "A"] }).ok).toBe(false);
    expect(validateItemContent("ORDERING", { prompt: "x", steps: Array.from({ length: 9 }, (_, i) => `s${i}`) }).ok).toBe(false);
  });
  it("needs exactly one best option in a scenario", () => {
    expect(validateItemContent("SCENARIO", { ...scenario, options: scenario.options.map((o) => ({ ...o, correct: false })) }).ok).toBe(false);
    expect(validateItemContent("SCENARIO", { ...scenario, options: scenario.options.map((o) => ({ ...o, correct: true })) }).ok).toBe(false);
    expect(validateItemContent("SCENARIO", { situation: "", options: scenario.options }).ok).toBe(false);
  });
  it("copes with nonsense", () => {
    expect(validateItemContent("MATCHING", null).ok).toBe(false);
    expect(validateItemContent("SCENARIO", "text").ok).toBe(false);
  });
});

describe("serveItem never gives away the answer", () => {
  it("matching: shuffled rights, no mapping", () => {
    const s = serveItem("MATCHING", matching, reverse);
    expect(s).toMatchObject({ format: "MATCHING", lefts: ["Trigger", "Action", "Filter"] });
    expect((s as { rights: string[] }).rights).toEqual(["Stops unwanted runs", "A step it performs", "Starts a workflow"]);
    expect(JSON.stringify(s)).not.toMatch(/pairs/);
  });
  it("ordering: never served already in order", () => {
    const s = serveItem("ORDERING", ordering, identity) as { steps: string[] };
    expect(s.steps).toHaveLength(4);
    const r = serveItem("ORDERING", ordering, reverse) as { steps: string[] };
    expect(r.steps).toEqual([...ordering.steps].reverse());
  });
  it("scenario: options without outcomes or the correct flag", () => {
    const s = serveItem("SCENARIO", scenario, identity);
    expect(JSON.stringify(s)).not.toMatch(/outcome|correct/i);
  });
});

describe("gradeItem", () => {
  it("matching: partial and full credit, and must be complete", () => {
    const all = Object.fromEntries(matching.pairs.map((p, i) => [String(i), p.right]));
    expect(gradeItem("MATCHING", matching, { matches: all })).toMatchObject({ score: 1, correct: true });
    const swapped = { ...all, "0": matching.pairs[1].right, "1": matching.pairs[0].right };
    const g = gradeItem("MATCHING", matching, { matches: swapped })!;
    expect(g.correct).toBe(false);
    expect(g.score).toBeCloseTo(1 / 3);
    expect(gradeItem("MATCHING", matching, { matches: { "0": "x" } })).toBeNull();
    expect(gradeItem("MATCHING", matching, {})).toBeNull();
  });
  it("ordering: scores by position, rejects tampering", () => {
    expect(gradeItem("ORDERING", ordering, { order: ordering.steps })).toMatchObject({ score: 1, correct: true });
    const g = gradeItem("ORDERING", ordering, { order: ["Add a filter", "Pick a trigger", "Add an action", "Test it"] })!;
    expect(g.score).toBe(0.5);
    expect(g.correct).toBe(false);
    expect(gradeItem("ORDERING", ordering, { order: ["Pick a trigger", "Pick a trigger", "Add an action", "Test it"] })).toBeNull();
    expect(gradeItem("ORDERING", ordering, { order: ["Made up", "Add a filter", "Add an action", "Test it"] })).toBeNull();
    expect(gradeItem("ORDERING", ordering, { order: ["Pick a trigger"] })).toBeNull();
  });
  it("scenario: right and wrong choices reveal the outcome", () => {
    const right = gradeItem("SCENARIO", scenario, { choice: "Check the run history" })!;
    expect(right).toMatchObject({ score: 1, correct: true });
    const wrong = gradeItem("SCENARIO", scenario, { choice: "Rebuild everything" })!;
    expect(wrong).toMatchObject({ score: 0, correct: false });
    expect(wrong.feedback).toMatchObject({ outcome: "That loses time and the cause.", best: "Check the run history" });
    expect(gradeItem("SCENARIO", scenario, { choice: "Something else" })).toBeNull();
  });
});

describe("helpers", () => {
  it("counts every visible word and titles items", () => {
    const t = itemText("ORDERING", ordering as ItemContent);
    expect(t).toContain("Pick a trigger");
    expect(itemTitle("MATCHING", matching)).toBe("Trigger, Action, Filter");
    expect(itemTitle("SCENARIO", { situation: "x".repeat(200), options: scenario.options }).length).toBeLessThanOrEqual(90);
  });
});
