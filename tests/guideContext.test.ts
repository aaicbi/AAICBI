import { describe, it, expect } from "vitest";
import { contextFor, isHiddenPath } from "@/lib/guide/context";
import { scrubQuestion } from "@/lib/guide/scrub";
import { afterShown, FRESH_BUBBLE_STATE, MAX_HINTS_PER_VISIT, nextHint } from "@/lib/guide/bubble";
import { DEFAULT_ENTRIES } from "@/lib/guide/defaults";
import { DESTINATIONS, filterLinks, isAvailable, isSafeHref, sanitizeLinks } from "@/lib/guide/links";
import { normalizeQuestion, tokens } from "@/lib/guide/text";
import type { GuideSwitches } from "@/lib/guide/types";

const ON: GuideSwitches = { orgPages: true, education: true, feed: true, publicJobs: true, publicTrainees: true };
const OFF: GuideSwitches = { orgPages: false, education: false, feed: false, publicJobs: false, publicTrainees: false };

describe("where Loop never appears", () => {
  it("hides during exams, assessments and assignments", () => {
    for (const p of [
      "/exam/ABC123/take", "/exam/enter", "/trainee/courses/c1/modules/m1/assessment", "/trainee/courses/c1/modules/m1/assessment/take",
      "/trainee/courses/c1/examination/take", "/trainee/examinations", "/trainee/assignments/a1",
    ]) expect(isHiddenPath(p), p).toBe(true);
  });
  it("hides in staff areas, but not the organization workspace or public admin pages", () => {
    for (const p of ["/admin/dashboard", "/admin/command", "/admin/courses", "/admin/ecosystem", "/instructor/courses"]) expect(isHiddenPath(p), p).toBe(true);
    for (const p of ["/admin/organization", "/admin/organization/events", "/admin/login", "/admin/forgot-password"]) expect(isHiddenPath(p), p).toBe(false);
  });
  it("shows everywhere else the ecosystem lives", () => {
    for (const p of ["/", "/courses", "/courses/c1", "/jobs", "/jobs/j1", "/organizations", "/organizations/x", "/trainees", "/learn", "/feed", "/events", "/search", "/certificate", "/trainee/dashboard", "/trainee/login", "/employer/dashboard", "/investor/dashboard", "/org/login", "/profile/u/amina"]) {
      expect(isHiddenPath(p), p).toBe(false);
    }
  });
});

describe("page context", () => {
  it("greets according to the page", () => {
    expect(contextFor("/", ON).key).toBe("home");
    expect(contextFor("/jobs", ON).greeting).toMatch(/opportunity/i);
    expect(contextFor("/organizations/x", ON).key).toBe("organizations");
    expect(contextFor("/trainee/login", ON).key).toBe("account");
    expect(contextFor("/somewhere/odd", ON).key).toBe("general");
  });
  it("offers at most six starting actions, each either a question or a page", () => {
    for (const p of ["/", "/courses", "/jobs", "/trainee/dashboard", "/employer/dashboard"]) {
      const q = contextFor(p, ON, "trainee").quick;
      expect(q.length).toBeGreaterThan(0);
      expect(q.length).toBeLessThanOrEqual(6);
      for (const a of q) expect([a.ask, a.href, a.page].filter(Boolean).length, a.label).toBe(1);
    }
  });
  it("offers to explain the page on every page except the home page", () => {
    expect(contextFor("/jobs", ON).quick.some((a) => a.page)).toBe(true);
    expect(contextFor("/", ON).quick.some((a) => a.page)).toBe(false);
  });
  it("puts a signed-in person's own shortcuts first", () => {
    expect(contextFor("/", ON, "trainee").quick[0]).toEqual({ label: "Go to my dashboard", href: "/trainee/dashboard" });
    expect(contextFor("/", ON, "employer").quick[0].href).toBe("/employer/dashboard");
    expect(contextFor("/", ON, null).quick[0].href).toBe("/#ecosystem");
  });
  it("leaves out actions for pages that are switched off", () => {
    const hrefs = [...contextFor("/", OFF).quick, ...contextFor("/jobs", OFF).quick].map((a) => a.href);
    expect(hrefs).not.toContain("/jobs");
    expect(hrefs).not.toContain("/organizations");
  });
});

describe("hints", () => {
  const page = { key: "home", bubbles: ["one", "two"] };
  it("speaks up a couple of times a visit, never twice on the same kind of page", () => {
    let s = FRESH_BUBBLE_STATE;
    expect(nextHint(page, s)).toBe("one");
    s = afterShown(s, "home");
    expect(nextHint(page, s)).toBeNull();
    expect(nextHint({ key: "jobs", bubbles: ["a", "b"] }, s)).toBe("b");
    s = afterShown(s, "jobs");
    expect(s.shownCount).toBe(MAX_HINTS_PER_VISIT);
    expect(nextHint({ key: "trainees", bubbles: ["x"] }, s)).toBeNull();
  });
  it("stays quiet once asked, and on pages with nothing to say", () => {
    expect(nextHint(page, { ...FRESH_BUBBLE_STATE, quiet: true })).toBeNull();
    expect(nextHint({ key: "k", bubbles: [] }, FRESH_BUBBLE_STATE)).toBeNull();
  });
});

describe("questions kept for the team", () => {
  it("removes anything that identifies a person", () => {
    expect(scrubQuestion("Email me at Amina.O@example.com about fees")).toBe("email me at [email] about fees");
    expect(scrubQuestion("call +234 803 111 2233 please")).toBe("call [number] please");
    expect(scrubQuestion("my id is 12345678 can i enrol")).toBe("my id is [number] can i enrol");
    expect(scrubQuestion("see https://example.com/x?y=1 please")).toBe("see [link] please");
  });
  it("tidies and limits", () => {
    expect(scrubQuestion("  How   much\n does it cost?  ")).toBe("how much does it cost?");
    expect(scrubQuestion("a".repeat(500))!.length).toBe(200);
  });
  it("keeps nothing when there is nothing to keep", () => {
    expect(scrubQuestion("")).toBeNull();
    expect(scrubQuestion("12")).toBeNull();
    expect(scrubQuestion("a@b.co")).toBeNull();
    expect(scrubQuestion("?!")).toBeNull();
  });
});

describe("links", () => {
  it("accepts only paths on this site", () => {
    for (const ok of ["/", "/jobs", "/jobs?q=Python", "/#join", "/search?q=C%2B%2B"]) expect(isSafeHref(ok), ok).toBe(true);
    for (const bad of ["", "jobs", "//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/a b", "/x\u0000", "/" + "a".repeat(250), "/\n"]) expect(isSafeHref(bad), JSON.stringify(bad)).toBe(false);
  });
  it("cleans a list of links from the database", () => {
    const out = sanitizeLinks([{ label: " Jobs ", href: "/jobs" }, { label: "Bad", href: "https://evil.com" }, { label: "", href: "/x" }, null, { label: 5, href: "/y" }, ...Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, href: `/p${i}` }))]);
    expect(out[0]).toEqual({ label: "Jobs", href: "/jobs" });
    expect(out.every((l) => isSafeHref(l.href))).toBe(true);
    expect(out).toHaveLength(5);
    expect(sanitizeLinks("nope")).toEqual([]);
  });
  it("follows the ecosystem switches, including pages with a query", () => {
    expect(isAvailable("/jobs?q=Python", OFF)).toBe(false);
    expect(isAvailable("/jobs?q=Python", ON)).toBe(true);
    expect(isAvailable("/learn", { ...ON, education: false })).toBe(false);
    expect(isAvailable("/organizations/some-org", OFF)).toBe(false);
    expect(isAvailable("/courses", OFF)).toBe(true);
    expect(filterLinks([{ label: "a", href: "/jobs" }, { label: "b", href: "/courses" }], OFF)).toEqual([{ label: "b", href: "/courses" }]);
  });
  it("has no duplicate destinations", () => {
    const hrefs = DESTINATIONS.map((d) => d.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("the built-in answers", () => {
  it("link only to pages in the directory", () => {
    const known = new Set(DESTINATIONS.map((d) => d.href));
    for (const e of DEFAULT_ENTRIES) for (const l of e.links) expect(known.has(l.href), `${e.id} -> ${l.href}`).toBe(true);
  });
  it("have unique ids and questions, an answer, and a sensible length", () => {
    expect(new Set(DEFAULT_ENTRIES.map((e) => e.id)).size).toBe(DEFAULT_ENTRIES.length);
    expect(new Set(DEFAULT_ENTRIES.map((e) => e.question)).size).toBe(DEFAULT_ENTRIES.length);
    for (const e of DEFAULT_ENTRIES) {
      expect(e.answer.length, e.id).toBeGreaterThan(30);
      expect(e.answer.length, e.id).toBeLessThan(500);
      expect(e.links.length, e.id).toBeLessThanOrEqual(5);
    }
  });
  it("state no prices, numbers or promises", () => {
    for (const e of DEFAULT_ENTRIES) {
      expect(e.answer, e.id).not.toMatch(/₦|\bNGN\b|\d|guarantee|promise|always|never fail/i);
    }
  });
});

describe("text helpers", () => {
  it("treats words that mean the same here as the same", () => {
    expect(tokens("any classes for data?")).toContain("training");
    expect(tokens("vacancies")).toEqual(["job"]);
    expect(tokens("I forgot my password")).toContain("resetpassword");
    expect(tokens("sign up")).toContain("register");
    expect(tokens("sign in")).toContain("login");
  });
  it("keeps weak words only when nothing else is left", () => {
    expect(tokens("what is this platform")).toEqual(["what", "platform"]);
    expect(tokens("what jobs are on the platform")).toEqual(["job"]);
  });
  it("normalizes a question for comparison", () => {
    expect(normalizeQuestion("Find the JOBS!")).toBe(normalizeQuestion("jobs find"));
  });
});
