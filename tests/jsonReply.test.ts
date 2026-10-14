import { describe, expect, it } from "vitest";
import { readJsonReply } from "@/lib/ai/jsonReply";

const q = (n: number) => ({ question: `Question ${n} with "quotes" and a } brace?`, options: ["A one", "B two"], correct_option_index: 0, explanation: "Because.", topic: "T" });

describe("readJsonReply", () => {
  it("reads plain JSON", () => {
    expect(readJsonReply('{"a":1}')).toEqual({ value: { a: 1 }, repaired: false });
  });
  it("reads JSON inside a code fence", () => {
    expect(readJsonReply('```json\n{"a":1}\n```').value).toEqual({ a: 1 });
  });
  it("reads JSON with a sentence before and after it", () => {
    expect(readJsonReply('Here are the questions:\n{"a":[1,2]}\nLet me know if you want more.').value).toEqual({ a: [1, 2] });
  });
  it("keeps the questions that arrived when the reply was cut off", () => {
    const full = JSON.stringify({ questions: [q(1), q(2), q(3)] });
    const cut = full.slice(0, full.indexOf("Question 3") + 12); // stops inside question 3
    const r = readJsonReply(cut);
    expect(r.repaired).toBe(true);
    expect((r.value as { questions: unknown[] }).questions).toHaveLength(2);
  });
  it("is not fooled by braces and quotes inside a question", () => {
    const full = JSON.stringify({ questions: [q(1), q(2)] });
    const r = readJsonReply(full.slice(0, full.length - 3));
    expect((r.value as { questions: unknown[] }).questions.length).toBeGreaterThanOrEqual(1);
  });
  it("gives up cleanly on something that is not JSON at all", () => {
    expect(readJsonReply("I can't help with that.").value).toBeUndefined();
    expect(readJsonReply("").value).toBeUndefined();
  });
});
