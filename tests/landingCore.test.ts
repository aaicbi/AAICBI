import { describe, it, expect } from "vitest";
import { buildActivity, closesIn, composeView, excerpt, fillWithSamples, MIN_REAL, SHOW, timeAgo } from "@/lib/landing/core";
import { ALL_SAMPLES, SAMPLE_LINKS } from "@/lib/landing/samples";
import { ALL_OFF, DEFAULT_FLAGS } from "@/lib/ecosystem/flags";
import type { LandingJob, LandingProgram, LandingReal } from "@/lib/landing/types";

const NOW = new Date("2026-10-08T12:00:00.000Z");

const realProgram = (n: number, at = "2026-10-07T12:00:00.000Z"): LandingProgram => ({
  id: `p${n}`, title: `Program ${n}`, description: null, category: null, level: null, duration: null, format: null, priceLabel: null,
  organizationName: "Real Org", organizationSlug: "real-org", href: `/courses/p${n}`, at, isSample: false,
});
const realJob = (n: number): LandingJob => ({
  id: `j${n}`, title: `Role ${n}`, company: "Real Co", summary: "", skills: [], closingDate: "2026-11-01T00:00:00.000Z", href: `/jobs/j${n}`, at: "2026-10-06T12:00:00.000Z", isSample: false,
});
const emptyReal = (): LandingReal => ({
  programs: [], jobs: [], organizations: [], trainees: [], events: [], videos: [], skills: [],
  stats: { organizations: 0, programs: 0, jobs: 0, videos: 0, trainees: 0 },
});

describe("fillWithSamples", () => {
  const sample = (n: number) => ({ n, isSample: true });
  const real = (n: number) => ({ n, isSample: false });

  it("fills an empty section up to the minimum with samples", () => {
    const out = fillWithSamples([], [sample(1), sample(2), sample(3), sample(4)], 3, true);
    expect(out).toHaveLength(3);
    expect(out.every((i) => i.isSample)).toBe(true);
  });

  it("keeps real items first and tops up only to the minimum", () => {
    const out = fillWithSamples([real(1)], [sample(1), sample(2), sample(3)], 3, true);
    expect(out.map((i) => i.isSample)).toEqual([false, true, true]);
  });

  it("shows no samples at all once there are enough real items", () => {
    const out = fillWithSamples([real(1), real(2), real(3)], [sample(1)], 3, true);
    expect(out.some((i) => i.isSample)).toBe(false);
  });

  it("never shows samples when placeholders are switched off", () => {
    expect(fillWithSamples([], [sample(1)], 3, false)).toEqual([]);
    expect(fillWithSamples([real(1)], [sample(1)], 3, false)).toEqual([real(1)]);
  });
});

describe("composeView", () => {
  it("shows only samples, all labelled, on a platform with no content yet", () => {
    const v = composeView(emptyReal(), ALL_SAMPLES, { placeholders: true }, NOW);
    expect(v.hasSamples).toBe(true);
    for (const list of [v.programs, v.jobs, v.organizations, v.trainees, v.events, v.videos, v.activity]) {
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((i) => i.isSample)).toBe(true);
    }
    expect(v.stats).toEqual({ organizations: 0, programs: 0, jobs: 0, videos: 0, trainees: 0 });
    expect(v.skills).toEqual([]);
  });

  it("shows nothing invented with placeholders off", () => {
    const v = composeView(emptyReal(), ALL_SAMPLES, { placeholders: false }, NOW);
    expect(v.hasSamples).toBe(false);
    expect(v.programs).toEqual([]);
    expect(v.activity).toEqual([]);
  });

  it("drops the samples of a section once it has enough real content, and only that section", () => {
    const real = { ...emptyReal(), programs: [realProgram(1), realProgram(2), realProgram(3)], jobs: [realJob(1)] };
    const v = composeView(real, ALL_SAMPLES, { placeholders: true }, NOW);
    expect(v.programs.every((p) => !p.isSample)).toBe(true);
    expect(v.jobs.map((j) => j.isSample)).toEqual([false, true, true]);
    expect(v.organizations.every((o) => o.isSample)).toBe(true);
  });

  it("never shows more real items than a section's limit", () => {
    const real = { ...emptyReal(), programs: Array.from({ length: 12 }, (_, i) => realProgram(i)) };
    expect(composeView(real, ALL_SAMPLES, { placeholders: true }, NOW).programs).toHaveLength(SHOW.programs);
  });
});

describe("buildActivity", () => {
  it("orders real activity newest first and labels none of it as a sample", () => {
    const real = { ...emptyReal(), programs: [realProgram(1, "2026-10-01T00:00:00.000Z"), realProgram(2, "2026-10-07T00:00:00.000Z")], jobs: [realJob(1)] };
    const items = buildActivity(real, NOW);
    expect(items.map((i) => i.id)).toEqual(["program-p2", "job-j1", "program-p1"]);
    expect(items.every((i) => !i.isSample)).toBe(true);
  });

  it("describes jobs and programs with the real names", () => {
    const items = buildActivity({ ...emptyReal(), programs: [realProgram(1)], jobs: [realJob(1)] }, NOW);
    expect(items.find((i) => i.kind === "program")!.text).toBe("New program: Program 1, by Real Org");
    expect(items.find((i) => i.kind === "job")!.text).toBe("Real Co is hiring: Role 1");
  });

  it("caps the list", () => {
    const real = { ...emptyReal(), programs: Array.from({ length: 20 }, (_, i) => realProgram(i)) };
    expect(buildActivity(real, NOW)).toHaveLength(SHOW.activity);
  });

  it("is empty when nothing real exists, so the page decides about placeholders", () => {
    expect(buildActivity(emptyReal(), NOW)).toEqual([]);
  });
});

describe("sample content rules", () => {
  const everything = [
    ...ALL_SAMPLES.programs, ...ALL_SAMPLES.jobs, ...ALL_SAMPLES.organizations, ...ALL_SAMPLES.trainees,
    ...ALL_SAMPLES.events, ...ALL_SAMPLES.videos, ...ALL_SAMPLES.activity,
  ];

  it("labels every sample as a sample", () => {
    expect(everything.every((i) => i.isSample === true)).toBe(true);
  });

  it("links every sample to a sign-up page and nowhere else", () => {
    const allowed = new Set<string>(Object.values(SAMPLE_LINKS));
    for (const item of everything) expect(allowed.has(item.href), `${item.href}`).toBe(true);
  });

  it("makes no claims: no statistics, ratings, prices, dates or outcomes", () => {
    const text = JSON.stringify(everything);
    expect(text).not.toMatch(/%|★|₦|\bNGN\b|rated|graduat|guarantee|certified|\bhired\b/i);
    for (const e of ALL_SAMPLES.events) expect(e.startsAt).toBeNull();
    for (const p of ALL_SAMPLES.programs) expect(p.priceLabel).toBeNull();
    for (const j of ALL_SAMPLES.jobs) expect(j.closingDate).toBeNull();
  });

  it("has enough samples to reach every section's minimum", () => {
    expect(ALL_SAMPLES.programs.length).toBeGreaterThanOrEqual(MIN_REAL.programs);
    expect(ALL_SAMPLES.jobs.length).toBeGreaterThanOrEqual(MIN_REAL.jobs);
    expect(ALL_SAMPLES.organizations.length).toBeGreaterThanOrEqual(MIN_REAL.organizations);
    expect(ALL_SAMPLES.trainees.length).toBeGreaterThanOrEqual(MIN_REAL.trainees);
    expect(ALL_SAMPLES.events.length).toBeGreaterThanOrEqual(MIN_REAL.events);
    expect(ALL_SAMPLES.videos.length).toBeGreaterThanOrEqual(MIN_REAL.videos);
    expect(ALL_SAMPLES.activity.length).toBeGreaterThanOrEqual(MIN_REAL.activity);
  });

  it("gives sample trainees no username, photo or profile link", () => {
    for (const t of ALL_SAMPLES.trainees) {
      expect(t.username).toBe("");
      expect(t.avatarUrl).toBeNull();
      expect(t.href).toBe(SAMPLE_LINKS.trainee);
    }
  });
});

describe("time helpers", () => {
  it("describes how long ago", () => {
    expect(timeAgo("2026-10-08T11:59:30.000Z", NOW)).toBe("just now");
    expect(timeAgo("2026-10-08T11:00:00.000Z", NOW)).toBe("1 hour ago");
    expect(timeAgo("2026-10-06T12:00:00.000Z", NOW)).toBe("2 days ago");
    expect(timeAgo("2026-10-10T12:00:00.000Z", NOW)).toBe("upcoming");
    expect(timeAgo(null, NOW)).toBe("");
  });

  it("describes when a job closes, and nothing once it has", () => {
    expect(closesIn("2026-10-13T12:00:00.000Z", NOW)).toBe("Closes in 5 days");
    expect(closesIn("2026-10-08T18:00:00.000Z", NOW)).toBe("Closes today");
    expect(closesIn("2026-10-01T12:00:00.000Z", NOW)).toBeNull();
    expect(closesIn(null, NOW)).toBeNull();
  });

  it("trims long text on a word boundary", () => {
    expect(excerpt("one two three four five", 12)).toBe("one two…");
    expect(excerpt("short", 12)).toBe("short");
    expect(excerpt(null, 12)).toBe("");
  });
});

describe("ecosystem switches", () => {
  it("start on, and every one is off when the database cannot be read", () => {
    expect(Object.values(DEFAULT_FLAGS).every(Boolean)).toBe(true);
    expect(Object.values(ALL_OFF).some(Boolean)).toBe(false);
    expect(Object.keys(DEFAULT_FLAGS).sort()).toEqual(Object.keys(ALL_OFF).sort());
  });
});

import { openJobWhere, publicTraineeWhere } from "@/lib/landing/publicWhere";

describe("what the public may see", () => {
  it("shows only approved, unexpired jobs of approved employers", () => {
    const now = new Date("2026-10-08T12:00:00.000Z");
    expect(openJobWhere(now)).toEqual({
      status: "APPROVED",
      closingDate: { gt: now },
      employer: { approvalState: "APPROVED" },
    });
  });

  it("shows only trainees who chose PUBLIC, with a username and a verified email", () => {
    expect(publicTraineeWhere()).toEqual({ profileVisibility: "PUBLIC", username: { not: null }, emailVerified: true });
  });
});
