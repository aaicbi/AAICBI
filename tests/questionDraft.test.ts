import { describe, expect, it } from "vitest";
import { questionDraftProblem, tidyDraft } from "@/lib/exams/questionDraft";

const ok = { text: "What is 2 + 2?", options: [{ text: "3", isCorrect: false }, { text: "4", isCorrect: true }] };

describe("a hand-typed question", () => {
  it("accepts two options with one correct", () => expect(questionDraftProblem(ok)).toBeNull());
  it("needs the question and enough options", () => {
    expect(questionDraftProblem({ ...ok, text: "  " })).toMatch(/Write the question/);
    expect(questionDraftProblem({ ...ok, options: [{ text: "4", isCorrect: true }] })).toMatch(/at least 2/);
    expect(questionDraftProblem({ ...ok, options: [{ text: "4", isCorrect: true }, { text: " ", isCorrect: false }] })).toMatch(/at least 2/);
    expect(questionDraftProblem({ ...ok, options: Array.from({ length: 7 }, (_, i) => ({ text: `o${i}`, isCorrect: i === 0 })) })).toMatch(/at most 6/);
  });
  it("needs exactly one correct answer", () => {
    expect(questionDraftProblem({ ...ok, options: ok.options.map((o) => ({ ...o, isCorrect: false })) })).toMatch(/Mark the correct/);
    expect(questionDraftProblem({ ...ok, options: ok.options.map((o) => ({ ...o, isCorrect: true })) })).toMatch(/only one/);
  });
  it("refuses two options that say the same thing, ignoring case and spacing", () => {
    expect(questionDraftProblem({ ...ok, options: [{ text: "Four", isCorrect: true }, { text: "  four ", isCorrect: false }] })).toMatch(/same thing/);
  });
  it("keeps lengths in check", () => {
    expect(questionDraftProblem({ ...ok, text: "x".repeat(2001) })).toMatch(/under 2000/);
    expect(questionDraftProblem({ ...ok, options: [{ text: "x".repeat(501), isCorrect: true }, { text: "y", isCorrect: false }] })).toMatch(/under 500/);
    expect(questionDraftProblem({ ...ok, explanation: "x".repeat(2001) })).toMatch(/explanation/);
  });
  it("tidies spaces and drops empty options and empty extras", () => {
    const t = tidyDraft({ text: "  Q?  ", topic: "  ", explanation: "", options: [{ text: " a   b ", isCorrect: true }, { text: "", isCorrect: false }] });
    expect(t).toEqual({ text: "Q?", topic: undefined, explanation: undefined, options: [{ text: "a b", isCorrect: true }] });
  });
});
