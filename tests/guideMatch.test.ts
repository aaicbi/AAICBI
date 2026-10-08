import { describe, it, expect } from "vitest";
import { answerQuestion, buildIndex, detectSkill, suggest } from "@/lib/guide/match";
import { DEFAULT_ENTRIES } from "@/lib/guide/defaults";
import type { GuideEntry, GuideSwitches } from "@/lib/guide/types";

const ALL_ON: GuideSwitches = { orgPages: true, education: true, feed: true, publicJobs: true, publicTrainees: true };
const SKILLS = ["Python", "SQL", "Data Analytics", "Data Cleaning", "JavaScript", "Digital Marketing", "Web Development", "C++", "Excel"];
const index = buildIndex(DEFAULT_ENTRIES, SKILLS);
const idOf = (q: string, on = ALL_ON) => {
  const r = answerQuestion(q, index, on);
  return r.kind === "answer" ? DEFAULT_ENTRIES.find((e) => e.question === r.matchedQuestion)!.id.replace("default:", "") : r.kind;
};

describe("finding the written answer", () => {
  const cases: Array<[string, string]> = [
    ["What is this platform?", "what-is"],
    ["what is aaicbi", "what-is"],
    ["tell me about this site", "what-is"],
    ["How does this platform work?", "how-it-works"],
    ["how does it work", "how-it-works"],
    ["who are you", "who-are-you"],
    ["are you a bot?", "who-are-you"],
    ["how do i create an account", "create-account"],
    ["i want to sign up", "create-account"],
    ["help me create an account", "create-account"],
    ["how do i register as a student", "trainee-register"],
    ["how do I become a training organization", "become-org"],
    ["i run a training academy, how do i join", "become-org"],
    ["how can my school list our programs", "become-org"],
    ["what can a training organization do", "org-features"],
    ["how can employers take part", "employer-take-part"],
    ["i want to hire graduates", "employer-take-part"],
    ["how do i post a job", "post-job"],
    ["how do i apply for a job", "apply-job"],
    ["can i apply without an account", "apply-job"],
    ["how do i find a training program", "find-training"],
    ["i want to learn something new", "find-training"],
    ["where can i find jobs", "find-jobs"],
    ["any vacancies?", "find-jobs"],
    ["internships", "find-jobs"],
    ["how can i find training organizations", "find-orgs"],
    ["show me academies", "find-orgs"],
    ["where can i see trainees", "find-trainees"],
    ["where can I find talent", "find-trainees"],
    ["upcoming events", "events"],
    ["any workshops", "events"],
    ["where can i watch videos", "videos"],
    ["how do i verify a certificate", "verify-certificate"],
    ["is this certificate genuine", "verify-certificate"],
    ["how do i get a certificate", "get-certificate"],
    ["how can investors take part", "investor"],
    ["i want to invest", "investor"],
    ["how do i log in", "login"],
    ["sign in", "login"],
    ["i forgot my password", "reset-password"],
    ["reset password", "reset-password"],
    ["is it free", "cost"],
    ["how much does it cost", "cost"],
    ["who can see my profile", "privacy"],
    ["is my data safe", "privacy"],
    ["how do i contact an employer", "contact"],
    ["can i message a trainee", "contact"],
    ["how do i follow an organization", "follow-org"],
    ["does it work on my phone", "phone"],
    ["is there an app", "phone"],
    ["can the ai help me study", "buddy"],
    ["can you give me the exam answers", "exam-answers"],
    ["how does an organization get featured", "featured"],
  ];
  for (const [q, expected] of cases) {
    it(`"${q}" -> ${expected}`, () => expect(idOf(q)).toBe(expected));
  }
});

describe("questions that are not written about", () => {
  for (const q of ["what is the weather today", "tell me a joke", "refund policy", "asdfgh", "who won the match"]) {
    it(`"${q}" falls back`, () => expect(idOf(q)).toBe("fallback"));
  }
});

describe("skills the platform has", () => {
  it("spots a skill, including multi-word and symbol names", () => {
    expect(detectSkill("any data analytics courses?", index)).toBe("Data Analytics");
    expect(detectSkill("I like C++ a lot", index)).toBe("C++");
    expect(detectSkill("Python jobs please", index)).toBe("Python");
    expect(detectSkill("something about cooking", index)).toBeNull();
  });
  it("offers links that search for the skill, ordered by what was asked", () => {
    const jobs = answerQuestion("python jobs", index, ALL_ON);
    expect(jobs.kind).toBe("topic");
    expect(jobs.links[0]).toEqual({ label: "See Python opportunities", href: "/jobs?q=Python" });
    const training = answerQuestion("I want to learn sql", index, ALL_ON);
    expect(training.links[0].href).toBe("/search?q=SQL");
  });
  it("adds the skill links in front of a matching written answer", () => {
    const r = answerQuestion("how do i apply for data analytics jobs", index, ALL_ON);
    expect(r.kind).toBe("answer");
    expect(r.matchedQuestion).toBe("How do I apply for a job?");
    expect(r.links.some((l) => l.href.includes("Data%20Analytics"))).toBe(true);
  });
  it("encodes the skill safely in the link", () => {
    const r = answerQuestion("c++ training", index, ALL_ON);
    expect(r.links.some((l) => l.href === "/search?q=C%2B%2B")).toBe(true);
  });
});

describe("typeahead", () => {
  it("suggests questions containing what has been typed", () => {
    expect(suggest("how do i reg", index)).toContain("How do I register as a trainee?");
    expect(suggest("cert", index).some((q) => /certificate/i.test(q))).toBe(true);
    expect(suggest("any cert", index).some((q) => /certificate/i.test(q))).toBe(true);
    expect(suggest("how do i", index)).toEqual([]);
    expect(suggest("a", index)).toEqual([]);
    expect(suggest("zzzz", index)).toEqual([]);
  });
});

describe("switches", () => {
  it("never links to a page that is switched off", () => {
    const off: GuideSwitches = { orgPages: false, education: false, feed: false, publicJobs: false, publicTrainees: false };
    for (const q of ["where can i find jobs", "show me academies", "any workshops", "where can i watch videos", "where can I find talent", "python jobs"]) {
      const r = answerQuestion(q, index, off);
      for (const l of r.links) expect(["/jobs", "/organizations", "/events", "/learn", "/feed", "/trainees", "/search"].some((p) => l.href.startsWith(p)), `${q} -> ${l.href}`).toBe(false);
    }
  });
  it("falls back to places that exist when everything is off", () => {
    const off: GuideSwitches = { orgPages: false, education: false, feed: false, publicJobs: false, publicTrainees: false };
    const r = answerQuestion("tell me a joke", index, off);
    expect(r.links.map((l) => l.href)).toEqual(["/courses", "/#join"]);
  });
});

describe("answers written by the team", () => {
  const custom: GuideEntry = { id: "custom:1", question: "How do I get a refund?", answer: "Write to the team.", links: [], keywords: ["refund", "money back"], source: "custom" };
  const withCustom = buildIndex([...DEFAULT_ENTRIES, custom], SKILLS);
  it("are found like the built-in ones", () => {
    const r = answerQuestion("refund policy", withCustom, ALL_ON);
    expect(r.kind).toBe("answer");
    expect(r.text).toBe("Write to the team.");
  });
  it("win a close call against a built-in answer", () => {
    const dup: GuideEntry = { ...custom, id: "custom:2", question: "How do I create an account?", answer: "Custom wording." };
    const r = answerQuestion("how do i create an account", buildIndex([...DEFAULT_ENTRIES, dup], SKILLS), ALL_ON);
    expect(r.text).toBe("Custom wording.");
  });
});

describe("the written answers themselves", () => {
  it("are all reachable by their own question", () => {
    for (const e of DEFAULT_ENTRIES) {
      const r = answerQuestion(e.question, index, ALL_ON);
      expect(r.matchedQuestion, e.question).toBe(e.question);
    }
  });
});
