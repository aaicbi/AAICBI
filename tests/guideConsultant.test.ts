import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ANSWER_MAX, ASK_SYSTEM_PROMPT, KNOWN_PAGES, KNOWN_TARGETS, REVIEW_SYSTEM_PROMPT, SUBMIT_REVIEW_TOOL, buildReviewContext, cleanDraft, cleanReviewItem, consultantAvailability, ReviewResultSchema } from "@/lib/guide/consultantCore";

describe("when the consultant may run", () => {
  it("is off until switched on, and needs the key", () => {
    expect(consultantAvailability({ enabled: false, hasKey: true })).toBe("off");
    expect(consultantAvailability({ enabled: false, hasKey: false })).toBe("off");
    expect(consultantAvailability({ enabled: true, hasKey: false })).toBe("not_configured");
    expect(consultantAvailability({ enabled: true, hasKey: true })).toBe("ready");
  });
});

describe("what Claude is shown", () => {
  const q = { text: "how do i invite another employer to my team?", variants: ["where do i invite employers to my team?"], asked: 9, roleCounts: { employer: 7, visitor: 2 }, feature: "employer/dashboard", confidence: 0.12, attempted: "how do i invite a teammate", reason: "NO_MATCH" };
  const ctx = buildReviewContext([q], [{ question: "How do I create an account?", answer: "Choose how you will use the platform and register.", category: null }]);
  it("gives references, counts and wording, and the list of real pages and controls", () => {
    expect(ctx).toContain("Q1:");
    expect(ctx).toContain("asked 9 time(s) by: employer 7, visitor 2");
    expect(ctx).toContain("A1:");
    expect(ctx).toContain("/trainee/messages");
    expect(ctx).toContain("create-course-submit");
  });
  it("carries no identity or database ids, and is capped", () => {
    expect(ctx).not.toMatch(/@|cmu[a-z0-9]{10,}|userId|email/i);
    const many = Array.from({ length: 40 }, (_, i) => ({ ...q, text: `question number ${i}` }));
    expect((buildReviewContext(many, []).match(/^Q\d+:/gm) ?? []).length).toBe(12);
  });
  it("tells Claude it only proposes, never to invent, and to use only real pages", () => {
    expect(REVIEW_SYSTEM_PROMPT).toMatch(/PROPOSAL/);
    expect(REVIEW_SYSTEM_PROMPT).toMatch(/NEVER invent/);
    expect(REVIEW_SYSTEM_PROMPT).toMatch(/copied exactly/);
    expect(ASK_SYSTEM_PROMPT).toMatch(/no tools that change anything/);
    expect(ASK_SYSTEM_PROMPT).toMatch(/not why/);
  });
  it("offers Claude no tool that could change anything", () => {
    expect(SUBMIT_REVIEW_TOOL.name).toBe("submit_review");
    expect(JSON.stringify(SUBMIT_REVIEW_TOOL)).not.toMatch(/delete|update|publish|approve/i);
  });
});

describe("checking what Claude proposes", () => {
  const ctx = { questions: new Map([["Q1", { text: "how do i message an employer?" }]]), entries: new Map([["A1", { question: "How do I create an account?" }]]) };
  const item = (over: object) => ReviewResultSchema.parse({ items: [{ ref: "Q1", action: "draft_answer", rationale: "Common question.", confidence: "high", draft: { question: "How do I message an employer?", answer: "Open Messages from your menu. Employers appear once you apply or accept an introduction." }, ...over }] }).items[0];

  it("keeps a good draft and always carries the check-the-facts warning", () => {
    const s = cleanReviewItem(item({}), ctx)!;
    expect(s.kind).toBe("DRAFT_ANSWER");
    expect(s.warnings[0]).toMatch(/Check the facts before approving/);
    expect((s.proposal.draft as { answer: string }).answer).toMatch(/Open Messages/);
  });
  it("removes a page or control that does not exist and says so", () => {
    const s = cleanReviewItem(item({ draft: { question: "q here", answer: "Open Messages from your menu to write to them.", navHref: "/trainee/inbox", target: "nav:/trainee/inbox", roles: ["trainee", "wizard"] } }), ctx)!;
    const d = s.proposal.draft as { navHref: unknown; target: unknown; roles: string[] };
    expect(d.navHref).toBeNull();
    expect(d.target).toBeNull();
    expect(d.roles).toEqual(["trainee"]);
    expect(s.warnings.join(" ")).toMatch(/page that does not exist/);
    expect(s.warnings.join(" ")).toMatch(/audiences .* do not exist/);
  });
  it("keeps a real page and its menu item", () => {
    const s = cleanReviewItem(item({ draft: { question: "q here", answer: "Open Messages from your menu to write to them.", navHref: "/trainee/messages", navLabel: "Open Messages", target: "nav:/trainee/messages", roles: ["trainee"] } }), ctx)!;
    const d = s.proposal.draft as { navHref: string; target: string; navLabel: string };
    expect([d.navHref, d.target, d.navLabel]).toEqual(["/trainee/messages", "nav:/trainee/messages", "Open Messages"]);
    expect(KNOWN_PAGES.has(d.navHref) && KNOWN_TARGETS.has(d.target)).toBe(true);
  });
  it("shortens an over-long answer and flags prices, dates and numbers that change", () => {
    const long = cleanDraft({ question: "q", answer: "x".repeat(900) } as never, "fallback");
    expect(long.draft.answer.length).toBeLessThanOrEqual(ANSWER_MAX);
    expect(long.warnings.join(" ")).toMatch(/shortened/);
    expect(cleanDraft({ question: "q", answer: "The fee is ₦5,000 per month for 3 months." } as never, "f").warnings.join(" ")).toMatch(/price, date or number/);
    expect(cleanDraft({ question: "q", answer: "Open Messages from the menu." } as never, "f").warnings).toEqual([]);
  });
  it("ignores a reference to a question that was not asked, and turns a bad merge or empty draft into advice", () => {
    expect(cleanReviewItem(item({ ref: "Q9" }), ctx)).toBeNull();
    expect(cleanReviewItem(item({ action: "merge_into_existing", mergeRef: "A7" }), ctx)!.kind).toBe("ADVICE");
    expect(cleanReviewItem(item({ action: "merge_into_existing", mergeRef: "A1" }), ctx)!.kind).toBe("MERGE");
    expect(cleanReviewItem(item({ draft: { question: "q", answer: "short" } }), ctx)!.kind).toBe("ADVICE");
    expect(cleanReviewItem(item({ action: "reject" }), ctx)!.kind).toBe("REJECT");
    expect(cleanReviewItem(item({ action: "needs_human" }), ctx)!.kind).toBe("ADVICE");
  });
  it("adds the model's own list of things to check, and flags low confidence", () => {
    const s = cleanReviewItem(item({ confidence: "low", verifyBeforeApproving: ["Do employers apply to trainees first?"] }), ctx)!;
    expect(s.warnings.join(" ")).toMatch(/Check: Do employers apply/);
    expect(s.warnings.join(" ")).toMatch(/low confidence/);
  });
});

describe("the consultant cannot change Loop's knowledge", () => {
  const files = (d: string, out: string[] = []): string[] => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) files(p, out); else if (/\.(ts|tsx)$/.test(n)) out.push(p); } return out; };
  const consultantFiles = [...files("src/app/api/admin/guide/consultant"), "src/lib/guide/consultantCore.ts", "src/lib/guide/consultant.ts"].filter((f) => { try { return statSync(f).isFile(); } catch { return false; } });
  it("has consultant files to check", () => expect(consultantFiles.length).toBeGreaterThan(3));
  it("none of them writes an answer, a question's status, or a setting other than the switch", () => {
    for (const f of consultantFiles) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/guideEntry\.(create|update|upsert|delete)/);
      expect(src, f).not.toMatch(/guideUnanswered\.(create|update|upsert|delete)/);
      expect(src, f).not.toMatch(/createEntry|updateEntry|restoreVersion/);
    }
  });
  it("every consultant route is for a super admin only", () => {
    for (const f of consultantFiles.filter((x) => x.endsWith("route.ts"))) expect(readFileSync(f, "utf8"), f).toMatch(/guideActor\(\)|requireRole\("SUPER_ADMIN"\)/);
  });
  it("the public guide routes never reach the consultant", () => {
    for (const f of files("src/app/api/guide")) expect(readFileSync(f, "utf8"), f).not.toMatch(/consultant/i);
  });
});
