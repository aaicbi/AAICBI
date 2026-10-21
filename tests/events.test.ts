import { describe, it, expect } from "vitest";
import {
  ANON, canChangeStatus, canView, changesPromo, checkHttpsUrl, detectProvider, dueReminder, embedFor, formatWhen, isBlobUrl, isPublished, joinDecision, monthGrid, nextPromotion,
  overlaps, phaseOf, registrationDecision, utcToLocalInput, validateEvent, validZone, weekDays, zonedToUtc, type Viewer, type ViewableEvent,
} from "@/lib/events/eventsCore";
import { noticeFor, type NoticeKind } from "@/lib/events/eventsNotices";
import { formatInstant } from "@/lib/events/eventsCore";
import { decryptPasscode, encryptPasscode } from "@/lib/events/eventsCrypto";

const NOW = new Date("2027-03-10T09:00:00Z");
const base = { title: "Intro to Python", summary: "A live class.", startLocal: "2027-03-20T10:00", endLocal: "2027-03-20T12:00", timeZone: "Africa/Lagos", delivery: "PHYSICAL", venueName: "Lagos Hub", address: "1 Marina", city: "Lagos", audience: "PRIVATE" };
const viewer = (o: Partial<Viewer> = {}): Viewer => ({ ...ANON, signedIn: true, profileId: "p1", ...o });
const ev = (o: Partial<ViewableEvent & { delivery: "PHYSICAL" | "ONLINE" | "HYBRID"; joinOpensMinutes: number | null; capacity: number | null; registrationDeadline: Date | null; registrationUrl: string | null }> = {}) => ({
  id: "e1", status: "SCHEDULED" as const, audience: "PUBLIC" as const, promotionStatus: "PUBLISHED" as const, publishAt: null, trainingOrganizationId: "org1",
  startsAt: new Date("2027-03-20T09:00:00Z"), endsAt: new Date("2027-03-20T11:00:00Z"), targets: [], registrationMode: "OPEN" as const,
  delivery: "ONLINE" as const, joinOpensMinutes: null, capacity: null, registrationDeadline: null, registrationUrl: null, ...o,
});

describe("time zones", () => {
  it("reads wall-clock time in the event's zone and stores a moment", () => {
    expect(zonedToUtc("2027-03-20T10:00", "Africa/Lagos")?.toISOString()).toBe("2027-03-20T09:00:00.000Z");
    expect(zonedToUtc("2027-01-12T10:00", "America/New_York")?.toISOString()).toBe("2027-01-12T15:00:00.000Z");
    expect(zonedToUtc("2027-07-12T10:00", "Europe/London")?.toISOString()).toBe("2027-07-12T09:00:00.000Z");
  });
  it("rejects dates and zones that do not exist", () => {
    expect(zonedToUtc("2027-02-30T10:00", "Africa/Lagos")).toBeNull();
    expect(zonedToUtc("2027-03-20 10:00", "Africa/Lagos")).toBeNull();
    expect(zonedToUtc("2027-03-20T10:00", "Mars/Base")).toBeNull();
    expect(validZone("Africa/Lagos")).toBe(true);
    expect(validZone("nope")).toBe(false);
  });
  it("round-trips to the form's boxes and names the zone beside every time", () => {
    const d = zonedToUtc("2027-03-20T10:00", "Africa/Lagos") as Date;
    expect(utcToLocalInput(d, "Africa/Lagos")).toBe("2027-03-20T10:00");
    expect(formatWhen(d, new Date(d.getTime() + 2 * 3600e3), "Africa/Lagos")).toBe("Sat, 20 Mar 2027, 10:00 to 12:00 WAT");
    expect(formatWhen(d, new Date(d.getTime() + 30 * 3600e3), "Africa/Lagos")).toContain("WAT");
  });
});

describe("links and media", () => {
  it("accepts only plain public https meeting links and names the provider", () => {
    expect(checkHttpsUrl("https://meet.google.com/abc-defg-hij").ok).toBe(true);
    for (const bad of ["http://zoom.us/j/1", "https://user:pw@zoom.us/j/1", "https://localhost/x", "https://10.0.0.5/x", "https://[::1]/x", "javascript:alert(1)", "zoom", ""]) expect(checkHttpsUrl(bad).ok).toBe(false);
    expect(detectProvider("meet.google.com")).toBe("Google Meet");
    expect(detectProvider("us02web.zoom.us")).toBe("Zoom");
    expect(detectProvider("teams.microsoft.com")).toBe("Microsoft Teams");
    expect(detectProvider("example.org")).toBe("Other video service");
    expect(detectProvider("evilzoom.us.example.com")).toBe("Other video service");
  });
  it("only trusts files this app stored, and only YouTube or Vimeo links for outside video", () => {
    expect(isBlobUrl("https://abc.public.blob.vercel-storage.com/events/flyer/x.png")).toBe(true);
    expect(isBlobUrl("https://evil.example.com/x.png")).toBe(false);
    expect(embedFor("https://youtu.be/dQw4w9WgXcQ")?.embedUrl).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.provider).toBe("YouTube");
    expect(embedFor("https://vimeo.com/123456789")?.provider).toBe("Vimeo");
    expect(embedFor("https://evil.example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(embedFor("http://youtu.be/dQw4w9WgXcQ")).toBeNull();
  });
});

describe("validating an event", () => {
  it("accepts a complete physical event and stores UTC", () => {
    const v = validateEvent(base, "schedule", NOW);
    expect(v.ok).toBe(true);
    expect(v.value?.startsAt.toISOString()).toBe("2027-03-20T09:00:00.000Z");
    expect(v.value?.join).toBeNull();
  });
  it("lets a draft keep only a title, but scheduling needs the details", () => {
    expect(validateEvent({ title: "Just an idea", startLocal: "2027-03-20T10:00", endLocal: "2027-03-20T11:00" }, "draft", NOW).ok).toBe(true);
    const s = validateEvent({ title: "Just an idea", startLocal: "2027-03-20T10:00", endLocal: "2027-03-20T11:00" }, "schedule", NOW);
    expect(s.ok).toBe(false);
    expect(s.errors.venueName).toBeTruthy();
  });
  it("needs the start before the end, and warns or refuses for the past", () => {
    expect(validateEvent({ ...base, endLocal: "2027-03-20T09:00" }, "schedule", NOW).errors.endLocal).toMatch(/after it starts/);
    expect(validateEvent({ ...base, startLocal: "2027-03-01T10:00", endLocal: "2027-03-01T12:00" }, "schedule", NOW).errors.endLocal).toMatch(/already over/);
    expect(validateEvent({ ...base, startLocal: "2027-03-01T10:00", endLocal: "2027-03-01T12:00" }, "draft", NOW).warnings.length).toBe(1);
    expect(validateEvent({ ...base, endLocal: "2027-04-20T12:00" }, "schedule", NOW).errors.endLocal).toMatch(/at most 14 days/);
  });
  it("shows only the fields that fit the delivery method", () => {
    const online = validateEvent({ ...base, delivery: "ONLINE", venueName: "ignored", meetingUrl: "https://meet.google.com/abc-defg-hij", passcode: "1234" }, "schedule", NOW);
    expect(online.ok).toBe(true);
    expect(online.value?.venueName).toBeNull();
    expect(online.value?.conferenceProvider).toBe("Google Meet");
    expect(online.value?.join?.passcode).toBe("1234");
    expect(validateEvent({ ...base, delivery: "ONLINE" }, "schedule", NOW).errors.meetingUrl).toBeTruthy();
    const physical = validateEvent({ ...base, meetingUrl: "https://zoom.us/j/1" }, "schedule", NOW);
    expect(physical.value?.join).toBeNull();
    const hybrid = validateEvent({ ...base, delivery: "HYBRID", meetingUrl: "https://zoom.us/j/1" }, "schedule", NOW);
    expect(hybrid.value?.venueName).toBe("Lagos Hub");
    expect(hybrid.value?.join?.meetingUrl).toContain("zoom.us");
    expect(validateEvent({ ...base, delivery: "ONLINE", meetingUrl: "http://zoom.us/j/1" }, "draft", NOW).errors.meetingUrl).toMatch(/https/);
  });
  it("needs someone chosen for a selected or invited audience", () => {
    expect(validateEvent({ ...base, audience: "SELECTED_TRAINEES" }, "schedule", NOW).errors.targets).toBeTruthy();
    expect(validateEvent({ ...base, audience: "SELECTED_TRAINEES", targets: [{ kind: "COHORT", refId: "c1" }, { kind: "COHORT", refId: "c1" }, { kind: "BAD", refId: "x" }] }, "schedule", NOW).value?.targets).toEqual([{ kind: "COHORT", refId: "c1" }]);
    expect(validateEvent({ ...base, audience: "PUBLIC", registrationMode: "INVITE_ONLY" }, "schedule", NOW).errors.registrationMode).toBeTruthy();
  });
  it("refuses pictures and files that this app did not store", () => {
    expect(validateEvent({ ...base, flyerUrl: "https://evil.example.com/x.png" }, "draft", NOW).errors.flyerUrl).toBeTruthy();
    expect(validateEvent({ ...base, videoUrl: "https://evil.example.com/v.mp4" }, "draft", NOW).errors.videoUrl).toBeTruthy();
    const ok = validateEvent({ ...base, flyerUrl: "https://a.public.blob.vercel-storage.com/events/flyer/x.png", videoUrl: "https://youtu.be/dQw4w9WgXcQ" }, "draft", NOW);
    expect(ok.value?.videoKind).toBe("EXTERNAL");
  });
  it("strips markup characters out of single-line text and bounds capacity and deadlines", () => {
    expect(validateEvent({ ...base, title: "Hello\u0000\n  world" }, "draft", NOW).value?.title).toBe("Hello world");
    expect(validateEvent({ ...base, capacity: 0 }, "draft", NOW).errors.capacity).toBeTruthy();
    expect(validateEvent({ ...base, capacity: 50 }, "draft", NOW).value?.capacity).toBe(50);
    expect(validateEvent({ ...base, registrationDeadlineLocal: "2027-03-21T10:00" }, "draft", NOW).errors.registrationDeadlineLocal).toBeTruthy();
  });
});

describe("lifecycle", () => {
  it("works out the phase from the clock", () => {
    const e = { status: "SCHEDULED" as const, startsAt: new Date("2027-03-20T09:00:00Z"), endsAt: new Date("2027-03-20T11:00:00Z") };
    expect(phaseOf(e, new Date("2027-03-19T00:00:00Z"))).toBe("UPCOMING");
    expect(phaseOf(e, new Date("2027-03-20T10:00:00Z"))).toBe("LIVE");
    expect(phaseOf(e, new Date("2027-03-20T12:00:00Z"))).toBe("COMPLETED");
    expect(phaseOf({ ...e, status: "CANCELLED" })).toBe("CANCELLED");
    expect(phaseOf({ ...e, status: "DRAFT" })).toBe("DRAFT");
  });
  it("allows only sensible status changes", () => {
    expect(canChangeStatus("DRAFT", "SCHEDULED", "DRAFT").ok).toBe(true);
    expect(canChangeStatus("SCHEDULED", "SCHEDULED", "UPCOMING").ok).toBe(false);
    expect(canChangeStatus("SCHEDULED", "CANCELLED", "UPCOMING").ok).toBe(true);
    expect(canChangeStatus("SCHEDULED", "CANCELLED", "COMPLETED").ok).toBe(false);
    expect(canChangeStatus("SCHEDULED", "DRAFT", "UPCOMING").ok).toBe(false);
    expect(canChangeStatus("SCHEDULED", "ARCHIVED", "UPCOMING").ok).toBe(false);
    expect(canChangeStatus("SCHEDULED", "ARCHIVED", "COMPLETED").ok).toBe(true);
    expect(canChangeStatus("CANCELLED", "ARCHIVED", "CANCELLED").ok).toBe(true);
    expect(canChangeStatus("DRAFT", "ARCHIVED", "DRAFT").ok).toBe(false);
  });
  it("walks the promotion workflow only in the allowed order", () => {
    expect(nextPromotion("NONE", "submit")).toEqual({ ok: true, to: "SUBMITTED" });
    expect(nextPromotion("SUBMITTED", "approve")).toEqual({ ok: true, to: "APPROVED" });
    expect(nextPromotion("APPROVED", "publish")).toEqual({ ok: true, to: "PUBLISHED" });
    expect(nextPromotion("NONE", "publish").ok).toBe(false);
    expect(nextPromotion("NONE", "approve").ok).toBe(false);
    expect(nextPromotion("PUBLISHED", "approve").ok).toBe(false);
    expect(nextPromotion("REJECTED", "submit").ok).toBe(true);
    expect(nextPromotion("PUBLISHED", "unpublish")).toEqual({ ok: true, to: "APPROVED" });
    expect(nextPromotion("SUBMITTED", "request_changes")).toEqual({ ok: true, to: "CHANGES_REQUESTED" });
  });
  it("sends a promoted event back for review when its promotional content changes", () => {
    expect(changesPromo({ title: "A", flyerUrl: null }, { title: "A", flyerUrl: null })).toBe(false);
    expect(changesPromo({ title: "A" }, { title: "B" })).toBe(true);
    expect(changesPromo({ title: "A", venueName: "X" }, { title: "A", venueName: "Y" })).toBe(false);
  });
  it("lists an event publicly only when scheduled, public and published", () => {
    const o = { status: "SCHEDULED" as const, audience: "PUBLIC" as const, promotionStatus: "PUBLISHED" as const, publishAt: null };
    expect(isPublished(o, NOW)).toBe(true);
    expect(isPublished({ ...o, promotionStatus: "SUBMITTED" }, NOW)).toBe(false);
    expect(isPublished({ ...o, promotionStatus: "APPROVED" }, NOW)).toBe(false);
    expect(isPublished({ ...o, promotionStatus: "APPROVED", publishAt: new Date("2027-03-11T00:00:00Z") }, NOW)).toBe(false);
    expect(isPublished({ ...o, promotionStatus: "APPROVED", publishAt: new Date("2027-03-09T00:00:00Z") }, NOW)).toBe(true);
    expect(isPublished({ ...o, status: "CANCELLED" }, NOW)).toBe(false);
    expect(isPublished({ ...o, audience: "PRIVATE" }, NOW)).toBe(false);
  });
});

describe("who can see an event", () => {
  it("shows a published public event to everyone, including visitors", () => {
    expect(canView(ev(), ANON, NOW)).toBe(true);
  });
  it("keeps an unapproved organisation event internal: the public cannot see it, its own people can", () => {
    const pending = ev({ promotionStatus: "SUBMITTED" });
    expect(canView(pending, ANON, NOW)).toBe(false);
    expect(canView(pending, viewer(), NOW)).toBe(false);
    expect(canView(pending, viewer({ memberOrgIds: ["org1"] }), NOW)).toBe(true);
    expect(canView(pending, viewer({ staffOrgId: "org1" }), NOW)).toBe(true);
    expect(canView(pending, viewer({ memberOrgIds: ["org2"], staffOrgId: "org2" }), NOW)).toBe(false);
  });
  it("hides drafts and archived events from everyone but managers", () => {
    expect(canView(ev({ status: "DRAFT" }), viewer({ memberOrgIds: ["org1"] }), NOW)).toBe(false);
    expect(canView(ev({ status: "DRAFT" }), viewer({ staffOrgId: "org1" }), NOW)).toBe(true);
    expect(canView(ev({ status: "DRAFT" }), viewer({ staffOrgId: "org2" }), NOW)).toBe(false);
    expect(canView(ev({ status: "ARCHIVED" }), viewer({ staffOrgId: "org1" }), NOW)).toBe(false);
    expect(canView(ev({ status: "ARCHIVED" }), viewer({ seesAll: true }), NOW)).toBe(true);
  });
  it("applies each audience rule", () => {
    const priv = ev({ audience: "PRIVATE", promotionStatus: "NONE" });
    expect(canView(priv, viewer({ memberOrgIds: ["org1"] }), NOW)).toBe(false);
    expect(canView(priv, viewer({ profileId: "p9" }), NOW)).toBe(false);
    expect(canView({ ...priv, targets: [{ kind: "PROFILE", refId: "p1" }] }, viewer(), NOW)).toBe(true);
    const staffOnly = ev({ audience: "ORG_STAFF", promotionStatus: "NONE" });
    expect(canView(staffOnly, viewer({ memberOrgIds: ["org1"] }), NOW)).toBe(false);
    expect(canView(staffOnly, viewer({ staffOrgId: "org1" }), NOW)).toBe(true);
    const members = ev({ audience: "ORG_MEMBERS", promotionStatus: "NONE" });
    expect(canView(members, viewer({ memberOrgIds: ["org1"] }), NOW)).toBe(true);
    expect(canView(members, viewer({ memberOrgIds: ["org2"] }), NOW)).toBe(false);
    const sel = ev({ audience: "SELECTED_TRAINEES", promotionStatus: "NONE", targets: [{ kind: "COHORT", refId: "c1" }, { kind: "COURSE", refId: "k1" }] });
    expect(canView(sel, viewer({ cohortIds: ["c1"], traineeId: "t1" }), NOW)).toBe(true);
    expect(canView(sel, viewer({ courseIds: ["k1"], traineeId: "t1" }), NOW)).toBe(true);
    expect(canView(sel, viewer({ cohortIds: ["c2"], traineeId: "t1" }), NOW)).toBe(false);
    expect(canView(sel, ANON, NOW)).toBe(false);
  });
  it("treats AAICBI's own events as visible to every organisation when meant for members or staff", () => {
    const own = ev({ trainingOrganizationId: null, audience: "ORG_STAFF", promotionStatus: "NONE" });
    expect(canView(own, viewer({ staffOrgId: "org7" }), NOW)).toBe(true);
    expect(canView(own, viewer({ memberOrgIds: ["org7"] }), NOW)).toBe(false);
  });
  it("tells people of a cancellation without showing it to the public", () => {
    const c = ev({ status: "CANCELLED" });
    expect(canView(c, viewer(), NOW)).toBe(true);
    expect(canView(c, ANON, NOW)).toBe(false);
  });
});

describe("joining details", () => {
  const managerless = (e: ReturnType<typeof ev>, v: Viewer, reg: { status: "CONFIRMED" | "PENDING" | "CANCELLED" | "DECLINED" } | null = null, now = NOW) => joinDecision(e, v, reg, false, 15, now);
  it("never gives details to a visitor, even for a public event", () => {
    expect(managerless(ev(), ANON, null, new Date("2027-03-20T08:50:00Z")).allowed).toBe(false);
  });
  it("opens shortly before the start and closes at the end", () => {
    const e = ev();
    expect(managerless(e, viewer(), null, new Date("2027-03-20T08:00:00Z")).allowed).toBe(false);
    expect(managerless(e, viewer(), null, new Date("2027-03-20T08:00:00Z")).opensAt?.toISOString()).toBe("2027-03-20T08:45:00.000Z");
    expect(managerless(e, viewer(), null, new Date("2027-03-20T08:50:00Z")).allowed).toBe(true);
    expect(managerless(e, viewer(), null, new Date("2027-03-20T10:00:00Z")).allowed).toBe(true);
    expect(managerless(e, viewer(), null, new Date("2027-03-20T11:30:00Z")).allowed).toBe(false);
  });
  it("needs a confirmed registration when the event asks for one", () => {
    const e = ev({ registrationMode: "REGISTRATION" });
    const t = new Date("2027-03-20T09:30:00Z");
    expect(managerless(e, viewer(), null, t).allowed).toBe(false);
    expect(managerless(e, viewer(), { status: "PENDING" }, t).allowed).toBe(false);
    expect(managerless(e, viewer(), { status: "CANCELLED" }, t).allowed).toBe(false);
    expect(managerless(e, viewer(), { status: "CONFIRMED" }, t).allowed).toBe(true);
  });
  it("is never available for a physical event, a cancelled event, or to someone who cannot see the event", () => {
    const t = new Date("2027-03-20T09:30:00Z");
    expect(managerless(ev({ delivery: "PHYSICAL" }), viewer(), null, t).allowed).toBe(false);
    expect(managerless(ev({ status: "CANCELLED" }), viewer(), null, t).allowed).toBe(false);
    expect(managerless(ev({ audience: "PRIVATE", promotionStatus: "NONE" }), viewer(), null, t).allowed).toBe(false);
    expect(joinDecision(ev({ audience: "PRIVATE", promotionStatus: "NONE" }), viewer(), null, true, 15, new Date("2027-03-01T00:00:00Z")).allowed).toBe(true);
  });
  it("lets organisers choose how early it opens", () => {
    expect(managerless(ev({ joinOpensMinutes: 120 }), viewer(), null, new Date("2027-03-20T07:30:00Z")).allowed).toBe(true);
  });
});

describe("registration", () => {
  const reg = (e: ReturnType<typeof ev>, v: Viewer, existing = null as { status: "CONFIRMED" | "PENDING" | "CANCELLED" | "DECLINED" } | null, n = 0, on = true) => registrationDecision(e, v, existing, n, on, NOW);
  it("needs a sign-in, a registration event, and a switched-on feature", () => {
    expect(reg(ev({ registrationMode: "REGISTRATION" }), ANON).ok).toBe(false);
    expect(reg(ev({ registrationMode: "OPEN" }), viewer()).ok).toBe(false);
    expect(reg(ev({ registrationMode: "REGISTRATION" }), viewer(), null, 0, false).ok).toBe(false);
    expect(reg(ev({ registrationMode: "REGISTRATION" }), viewer())).toEqual({ ok: true, status: "CONFIRMED" });
  });
  it("sends approval events to the organiser and respects capacity, deadlines and duplicates", () => {
    expect(reg(ev({ registrationMode: "APPROVAL" }), viewer())).toEqual({ ok: true, status: "PENDING" });
    expect(reg(ev({ registrationMode: "REGISTRATION", capacity: 5 }), viewer(), null, 5).reason).toMatch(/full/);
    expect(reg(ev({ registrationMode: "REGISTRATION", capacity: 5 }), viewer(), null, 4).ok).toBe(true);
    expect(reg(ev({ registrationMode: "REGISTRATION", registrationDeadline: new Date("2027-03-09T00:00:00Z") }), viewer()).reason).toMatch(/deadline/);
    expect(reg(ev({ registrationMode: "REGISTRATION" }), viewer(), { status: "CONFIRMED" }).reason).toMatch(/already/);
    expect(reg(ev({ registrationMode: "REGISTRATION" }), viewer(), { status: "CANCELLED" }).ok).toBe(true);
    expect(reg(ev({ registrationMode: "REGISTRATION" }), viewer(), { status: "DECLINED" }).ok).toBe(false);
  });
  it("lets only invited people into an invite-only event", () => {
    const e = ev({ audience: "INVITED", promotionStatus: "NONE", registrationMode: "INVITE_ONLY", targets: [{ kind: "PROFILE", refId: "p1" }] });
    expect(reg(e, viewer()).ok).toBe(true);
    expect(reg(e, viewer({ profileId: "p2" })).ok).toBe(false);
  });
  it("refuses a cancelled or finished event", () => {
    expect(reg(ev({ registrationMode: "REGISTRATION", status: "CANCELLED" }), viewer()).ok).toBe(false);
    expect(registrationDecision(ev({ registrationMode: "REGISTRATION" }), viewer(), null, 0, true, new Date("2027-03-21T00:00:00Z")).ok).toBe(false);
  });
});

describe("reminders and calendar", () => {
  const start = new Date("2027-03-20T09:00:00Z");
  it("sends each reminder once, in the right window", () => {
    expect(dueReminder(start, new Date("2027-03-19T09:10:00Z"), new Set())?.kind).toBe("REMINDER_DAY");
    expect(dueReminder(start, new Date("2027-03-19T09:10:00Z"), new Set(["REMINDER_DAY"]))).toBeNull();
    expect(dueReminder(start, new Date("2027-03-20T08:10:00Z"), new Set(["REMINDER_DAY"]))?.kind).toBe("REMINDER_HOUR");
    expect(dueReminder(start, new Date("2027-03-20T08:10:00Z"), new Set(["REMINDER_DAY", "REMINDER_HOUR"]))).toBeNull();
    expect(dueReminder(start, new Date("2027-03-10T09:00:00Z"), new Set())).toBeNull();
    expect(dueReminder(start, new Date("2027-03-20T09:30:00Z"), new Set())).toBeNull();
  });
  it("detects overlap, builds month and week grids", () => {
    const a = { startsAt: new Date("2027-03-20T09:00:00Z"), endsAt: new Date("2027-03-20T11:00:00Z") };
    expect(overlaps(a, { startsAt: new Date("2027-03-20T10:00:00Z"), endsAt: new Date("2027-03-20T12:00:00Z") })).toBe(true);
    expect(overlaps(a, { startsAt: new Date("2027-03-20T11:00:00Z"), endsAt: new Date("2027-03-20T12:00:00Z") })).toBe(false);
    const g = monthGrid(2027, 2);
    expect(g[0][0].key <= "2027-03-01").toBe(true);
    expect(g.flat().filter((c) => c.inMonth)).toHaveLength(31);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(weekDays("2027-03-20")[0]).toBe("2027-03-15");
  });
});

describe("meeting passcodes", () => {
  it("are encrypted at rest and come back only through decryption", () => {
    process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
    const enc = encryptPasscode("s3cret-pass");
    expect(enc).not.toContain("s3cret");
    expect(decryptPasscode(enc)).toBe("s3cret-pass");
    expect(decryptPasscode(enc.replace(/.$/, "A"))).toBeNull();
    expect(decryptPasscode("plain")).toBeNull();
    expect(decryptPasscode(null)).toBeNull();
    expect(encryptPasscode("s3cret-pass")).not.toBe(enc);
  });
});

describe("notification wording", () => {
  const e = { id: "e1", title: "Intro to Python", startsAt: new Date("2027-03-20T09:00:00Z"), endsAt: new Date("2027-03-20T11:00:00Z"), timeZone: "Africa/Lagos", organizer: "Northwind Academy" };
  const kinds: NoticeKind[] = ["PUBLISHED", "INVITED", "REMINDER_DAY", "REMINDER_HOUR", "RESCHEDULED", "CANCELLED", "PROMOTION_SUBMITTED", "PROMOTION_APPROVED", "PROMOTION_REJECTED", "PROMOTION_CHANGES", "PROMOTION_PUBLISHED", "PROMOTION_PULLED", "REGISTERED", "REGISTRATION_PENDING", "REGISTRATION_CONFIRMED", "REGISTRATION_DECLINED", "REGISTRATION_REQUEST"];
  it("names the time with its zone and links only to the event page, never to a meeting", () => {
    for (const k of kinds) {
      const n = noticeFor(k, e, { reason: "Venue unavailable", who: "Northwind" });
      expect(n.url.startsWith("/")).toBe(true);
      expect(n.type.startsWith("EVENT_")).toBe(true);
      expect(`${n.title} ${n.body}`).not.toMatch(/https?:|meet\.google|zoom\.us|teams\.microsoft|passcode/i);
    }
    expect(noticeFor("RESCHEDULED", e).body).toContain("WAT");
    expect(noticeFor("CANCELLED", e, { reason: "Venue unavailable" }).body).toContain("Venue unavailable");
  });
  it("shows a single moment with its zone", () => {
    expect(formatInstant(new Date("2027-03-20T09:00:00Z"), "Africa/Lagos")).toBe("Sat, 20 Mar 2027, 10:00 WAT");
  });
});
