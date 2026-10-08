import { describe, it, expect } from "vitest";
import { EntrySchema, UnansweredAction } from "@/lib/guide/adminSchemas";

const ok = { question: "How do I get a refund?", answer: "Write to the team and we will help.", links: [{ label: "Programs", href: "/courses" }], keywords: ["refund", "money back"] };

describe("a written answer", () => {
  it("accepts a good one and fills in the defaults", () => {
    const r = EntrySchema.parse({ question: "Any scholarships?", answer: "Not at the moment, check back soon." });
    expect(r.links).toEqual([]);
    expect(r.keywords).toEqual([]);
    expect(r.enabled).toBe(true);
    expect(EntrySchema.safeParse(ok).success).toBe(true);
  });

  it("rejects a question or answer that is too short or too long", () => {
    expect(EntrySchema.safeParse({ ...ok, question: "Hi" }).success).toBe(false);
    expect(EntrySchema.safeParse({ ...ok, answer: "Too short" }).success).toBe(false);
    expect(EntrySchema.safeParse({ ...ok, answer: "x".repeat(601) }).success).toBe(false);
    expect(EntrySchema.safeParse({ ...ok, question: "q".repeat(201) }).success).toBe(false);
  });

  it("rejects links that leave the site", () => {
    for (const href of ["https://evil.com", "//evil.com", "javascript:alert(1)", "courses", "/a b"]) {
      const r = EntrySchema.safeParse({ ...ok, links: [{ label: "x", href }] });
      expect(r.success, href).toBe(false);
    }
  });

  it("limits links and keywords", () => {
    const links = Array.from({ length: 6 }, (_, i) => ({ label: `L${i}`, href: `/p${i}` }));
    expect(EntrySchema.safeParse({ ...ok, links }).success).toBe(false);
    expect(EntrySchema.safeParse({ ...ok, keywords: Array.from({ length: 11 }, (_, i) => `k${i}`) }).success).toBe(false);
  });

  it("trims what it is given", () => {
    const r = EntrySchema.parse({ ...ok, question: "  How do I get a refund?  ", keywords: [" refund "] });
    expect(r.question).toBe("How do I get a refund?");
    expect(r.keywords).toEqual(["refund"]);
  });
});

describe("dealing with an unanswered question", () => {
  it("answers it with a full written answer, or dismisses or reopens it", () => {
    expect(UnansweredAction.safeParse({ action: "answer", ...ok }).success).toBe(true);
    expect(UnansweredAction.safeParse({ action: "dismiss" }).success).toBe(true);
    expect(UnansweredAction.safeParse({ action: "reopen" }).success).toBe(true);
  });
  it("refuses an answer with nothing written, and unknown actions", () => {
    expect(UnansweredAction.safeParse({ action: "answer" }).success).toBe(false);
    expect(UnansweredAction.safeParse({ action: "delete" }).success).toBe(false);
  });
});
