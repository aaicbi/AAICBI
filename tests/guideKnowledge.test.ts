import { describe, it, expect } from "vitest";
import { findSimilar, tokenKeyOf, addVariant, sameMeaning } from "@/lib/guide/similarity";
import { priorityOf } from "@/lib/guide/priority";
import { classifyIntent } from "@/lib/guide/intent";
import { canOpen, deniedReply, destinationsFor, resolveDestination, navTarget, GUIDE_DESTINATIONS } from "@/lib/guide/navigation";

const ON = { orgPages: true, education: true, feed: true, publicJobs: true, publicTrainees: true };

describe("grouping the same question asked different ways", () => {
  const asks = ["How do I message an employer?", "Where can I chat with an employer?", "How can I send a message to an employer?"];
  it("reduces differently worded questions to one meaning", () => {
    const keys = asks.map(tokenKeyOf);
    expect(new Set(keys).size).toBe(1);
  });
  it("finds the existing row for a new wording, and nothing for a different topic", () => {
    const rows = [{ id: "a", tokenKey: tokenKeyOf(asks[0]) }, { id: "b", tokenKey: tokenKeyOf("How do I change my profile picture?") }];
    expect(findSimilar("Can I contact an employer by chat?", rows)?.id).toBe("a");
    expect(findSimilar("How do I change my profile photo?", rows)?.id).toBe("b");
    expect(findSimilar("How do I pay for a course?", rows)).toBeNull();
  });
  it("does not merge questions that only share a word", () => {
    expect(sameMeaning(tokenKeyOf("message an employer"), tokenKeyOf("message a trainee"))).toBe(false);
  });
  it("keeps each new wording once, capped", () => {
    let v: string[] = [];
    v = addVariant(v, "b", "a");
    v = addVariant(v, "b", "a");
    v = addVariant(v, "a", "a");
    expect(v).toEqual(["b"]);
    for (let i = 0; i < 30; i++) v = addVariant(v, `q${i}`, "a");
    expect(v.length).toBeLessThanOrEqual(12);
  });
});

describe("question priority", () => {
  const now = Date.now();
  const base = { lastAskedAt: now, roleCounts: {} as Record<string, number>, text: "can i change the dashboard background" };
  it("ranks a frequently asked question above a rare one", () => {
    expect(priorityOf({ ...base, asked: 48, text: "how do i apply for an opportunity", roleCounts: { trainee: 40, visitor: 8 } }, now).level).toBe("HIGH");
    expect(priorityOf({ ...base, asked: 11, text: "how do i change my profile picture" }, now).level).toBe("MEDIUM");
    expect(priorityOf({ ...base, asked: 1 }, now).level).toBe("LOW");
  });
  it("lets recency and business topics raise a question, and old ones fade", () => {
    const fresh = priorityOf({ ...base, asked: 5 }, now).score;
    const old = priorityOf({ ...base, asked: 5, lastAskedAt: now - 90 * 86400000 }, now).score;
    expect(fresh).toBeGreaterThan(old);
    expect(priorityOf({ ...base, asked: 5, text: "how do i get a refund for payment" }, now).score).toBeGreaterThan(fresh);
  });
});

describe("what the person wants", () => {
  it.each([
    ["What is Analytics?", "info", "analytics"],
    ["Where is Analytics?", "navigate", "analytics"],
    ["Where can I find my messages?", "navigate", "messages"],
    ["How do I use Analytics?", "instruct", "use analytics"],
    ["Show me how to use Analytics", "demo", "use analytics"],
    ["Walk me through creating a course", "demo", "creating a course"],
    ["Open Analytics", "action", "analytics"],
    ["Take me to my courses", "action", "courses"],
    ["analytics", "info", "analytics"],
  ])("%s", (q, intent, subject) => {
    const r = classifyIntent(q);
    expect(r.intent).toBe(intent);
    expect(r.subject).toBe(subject);
  });
});

describe("role-aware places", () => {
  it("sends each kind of account to its own page for the same request", () => {
    const find = (s: string, me: Parameters<typeof resolveDestination>[1]) => {
      const r = resolveDestination(s, me, ON);
      return r.kind === "found" ? r.dest.href : r.kind;
    };
    expect(find("messages", "trainee")).toBe("/trainee/messages");
    expect(find("messages", "employer")).toBe("/employer/messages");
    expect(find("messages", "organization")).toBe("/admin/messages");
    expect(find("assessment results", "trainee")).toBe("/trainee/examinations");
    expect(find("analytics", "trainee")).toBe("/trainee/my-activity");
    expect(find("analytics", "staff")).toBe("/admin/analytics");
    expect(find("notifications", "employer")).toBe("/notifications");
    expect(find("find talent", "employer")).toBe("/employer/discover");
  });
  it("never offers an account a page that belongs to another", () => {
    for (const me of ["trainee", "employer", "investor", "organization", "staff"] as const) {
      for (const d of destinationsFor(me, ON)) expect(canOpen(d.href, me), `${me} ${d.href}`).toBe(true);
    }
    expect(canOpen("/trainee/examinations", "employer")).toBe(false);
    expect(canOpen("/admin/analytics", "organization")).toBe(false);
    expect(canOpen("/employer/messages", null)).toBe(false);
    expect(canOpen("/jobs", null)).toBe(true);
  });
  it("says so when a feature belongs to someone else, and how to get access", () => {
    const r = resolveDestination("assessment results", "employer", ON);
    expect(r.kind).toBe("denied");
    if (r.kind === "denied") {
      const d = deniedReply(r.dest, r.owner, "employer");
      expect(d.text).toMatch(/available to trainees/);
      expect(d.text).toMatch(/doesn't have access/);
      expect(d.links[0].href).toBe("/trainee/register");
    }
  });
  it("lets a visitor know to sign in for a signed-in feature", () => {
    const r = resolveDestination("my messages", null, ON);
    expect(r.kind).toBe("denied");
  });
  it("gives every place a stable target id and skips places whose switch is off", () => {
    for (const d of GUIDE_DESTINATIONS) expect(d.target).toBe(navTarget(d.href));
    const off = { ...ON, publicJobs: false };
    expect(destinationsFor(null, off).some((d) => d.href === "/jobs")).toBe(false);
  });
});

import { bumpRole, cleanConfidence, cleanRole, featureOf, scrubContext, scrubPage, scrubRoute, strongerReason } from "@/lib/guide/record";
import { EntrySchema, UnansweredAction } from "@/lib/guide/adminSchemas";
import { CONTROL_TARGETS } from "@/lib/guide/controlTargets";
import { actionsFor, answerQuestion, buildIndex, ANSWER_CONFIDENT } from "@/lib/guide/match";
import { DEFAULT_ENTRIES } from "@/lib/guide/defaults";
import { entriesForAudience } from "@/lib/guide/playbooks";
import type { GuideEntry } from "@/lib/guide/types";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

describe("what is kept about a question", () => {
  it("strips ids, queries and anything personal from the page address", () => {
    expect(scrubRoute("/trainee/courses/cmuznki4u000ip61x2v21ycrq?token=abc#x")).toBe("/trainee/courses/[id]");
    expect(scrubRoute("/admin/courses/123456/preview")).toBe("/admin/courses/[id]/preview");
    expect(scrubRoute("/employer/dashboard")).toBe("/employer/dashboard");
    expect(scrubRoute("https://evil.com/x")).toBeNull();
    expect(scrubRoute(42)).toBeNull();
    expect(featureOf("/trainee/courses/[id]")).toBe("trainee/courses");
    expect(featureOf("/")).toBe("home");
  });
  it("scrubs the page title and the last few things typed", () => {
    expect(scrubPage("My Courses | AAICBI for ada@example.com")).not.toContain("@");
    expect(scrubContext(["first", "call me on 08012345678", "x", "last one here"]).join(" ")).not.toMatch(/0801/);
    expect(scrubContext(["a1 question", "b2 question", "c3 question", "d4 question"]).length).toBe(3);
    expect(scrubContext("nope")).toEqual([]);
  });
  it("only accepts known kinds of account and sane numbers", () => {
    expect(cleanRole("trainee")).toBe("trainee");
    expect(cleanRole("hacker")).toBe("visitor");
    expect(cleanConfidence(0.4567)).toBe(0.46);
    expect(cleanConfidence(9)).toBe(1);
    expect(cleanConfidence("x")).toBeNull();
  });
  it("counts asks by kind of account and keeps the strongest reason", () => {
    expect(bumpRole({ trainee: 2 }, "trainee")).toEqual({ trainee: 3 });
    expect(bumpRole(null, "visitor")).toEqual({ visitor: 1 });
    expect(strongerReason("LOW_CONFIDENCE", "NO_MATCH")).toBe("NO_MATCH");
    expect(strongerReason("NOT_HELPFUL", "LOW_CONFIDENCE")).toBe("LOW_CONFIDENCE");
  });
});

describe("approved answers", () => {
  const base = { question: "How do I contact support?", answer: "Use the Messages page to write to the team." };
  it("takes the new fields, with defaults, and treats blanks as none", () => {
    const e = EntrySchema.parse({ ...base, category: "", navHref: "", target: "", navLabel: "" });
    expect(e.category).toBeNull();
    expect(e.navHref).toBeNull();
    expect(e.target).toBeNull();
    expect(e.relatedQuestions).toEqual([]);
    expect(e.roles).toEqual([]);
    const full = EntrySchema.parse({ ...base, category: "Messaging", navHref: "/trainee/messages", navLabel: "Open Messages", target: "nav:/trainee/messages", relatedQuestions: ["Where do I chat?"], roles: ["trainee"] });
    expect(full.navHref).toBe("/trainee/messages");
  });
  it("refuses a destination off the site, a bad target, an unknown role", () => {
    expect(EntrySchema.safeParse({ ...base, navHref: "https://evil.com" }).success).toBe(false);
    expect(EntrySchema.safeParse({ ...base, navHref: "//evil.com" }).success).toBe(false);
    expect(EntrySchema.safeParse({ ...base, target: 'x"]<script>' }).success).toBe(false);
    expect(EntrySchema.safeParse({ ...base, roles: ["admin"] }).success).toBe(false);
    expect(EntrySchema.safeParse({ ...base, relatedQuestions: Array.from({ length: 9 }, (_, i) => `question ${i}`) }).success).toBe(false);
  });
  it("lets the team review, reject, merge, resolve and categorize", () => {
    expect(UnansweredAction.safeParse({ action: "review" }).success).toBe(true);
    expect(UnansweredAction.safeParse({ action: "reject", note: "not for the guide" }).success).toBe(true);
    expect(UnansweredAction.safeParse({ action: "resolve" }).success).toBe(true);
    expect(UnansweredAction.safeParse({ action: "categorize", category: "Messaging" }).success).toBe(true);
    expect(UnansweredAction.safeParse({ action: "merge", intoEntryId: "e1" }).success).toBe(true);
    expect(UnansweredAction.safeParse({ action: "merge", intoQuestionId: "q1" }).success).toBe(true);
    expect(UnansweredAction.safeParse({ action: "merge" }).success).toBe(false);
    expect(UnansweredAction.safeParse({ action: "merge", intoEntryId: "e1", intoQuestionId: "q1" }).success).toBe(false);
  });
});

describe("what Loop says, and to whom", () => {
  const custom = (over: Partial<GuideEntry>): GuideEntry => ({ id: "custom:1", dbId: "1", question: "How do I contact support?", answer: "Use the Messages page to write to the team.", links: [], keywords: [], source: "custom", ...over });
  const run = (entries: GuideEntry[], q: string, me: Parameters<typeof answerQuestion>[3] = null) => answerQuestion(q, buildIndex(entriesForAudience(entries, me)), ON, me);

  it("admits it does not know, and says it was recorded, instead of guessing", () => {
    const r = run(DEFAULT_ENTRIES, "can i change the colour of my dashboard background to purple");
    expect(r.kind).toBe("fallback");
    expect(r.lowConfidence).toBe(true);
    expect(r.text).toMatch(/don't have a reliable answer/);
    expect(r.text).toMatch(/recorded your question/);
  });
  it("answers confidently from an approved answer, and flags a weak match", () => {
    const entries = [...DEFAULT_ENTRIES, custom({})];
    const sure = run(entries, "How do I contact support?");
    expect(sure.kind).toBe("answer");
    expect(sure.confidence).toBeGreaterThanOrEqual(ANSWER_CONFIDENT);
    expect(sure.lowConfidence).toBe(false);
    expect(sure.entryDbId).toBe("1");
  });
  it("finds an approved answer by the other ways people ask it", () => {
    const entries = [...DEFAULT_ENTRIES, custom({ question: "How do I talk to the team?", answer: "Use the Messages page to write to the team.", relatedQuestions: ["Where can I reach support staff?"] })];
    const r = run(entries, "Where can I reach support staff?");
    expect(r.entryDbId).toBe("1");
  });
  it("adds Take me there and Show me for an account that may open the page", () => {
    const e = custom({ navHref: "/trainee/messages", navLabel: "Open Messages", target: "nav:/trainee/messages" });
    const { actions } = actionsFor(e, "trainee");
    expect(actions.map((a) => a.kind)).toEqual(["go", "show"]);
    expect(actions[0].label).toBe("Open Messages");
    expect(actions[1].target).toBe("nav:/trainee/messages");
  });
  it("does not point an account at a page it cannot open, and says why", () => {
    const e = custom({ navHref: "/trainee/messages", target: "nav:/trainee/messages" });
    const r = actionsFor(e, "employer");
    expect(r.actions).toEqual([]);
    expect(r.note).toMatch(/available to trainees/);
    expect(actionsFor(e, null).note).toMatch(/Sign in/);
  });
  it("keeps an answer written for one kind of account away from the others", () => {
    const entries = [...DEFAULT_ENTRIES, custom({ roles: ["employer"], question: "How do I invite another employer to my team?", answer: "Employers cannot add teammates yet; contact the platform team." })];
    expect(run(entries, "How do I invite another employer to my team?", "employer").entryDbId).toBe("1");
    expect(run(entries, "How do I invite another employer to my team?", "trainee").entryDbId).toBeUndefined();
  });
});

describe("pointing targets stay honest", () => {
  it("every control in the list exists in the code", () => {
    const walk = (d: string, out: string[] = []): string[] => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.tsx$/.test(n)) out.push(readFileSync(p, "utf8")); } return out; };
    const src = walk("src").join("\n");
    for (const c of CONTROL_TARGETS) expect(src.includes(`data-guide-target="${c.id}"`), c.id).toBe(true);
  });
});
