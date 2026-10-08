import type {
  ActivityItem,
  LandingReal,
  LandingView,
  Sampled,
} from "@/lib/landing/types";

/** How many real items a section needs before its placeholders disappear. */
export const MIN_REAL = {
  programs: 3,
  jobs: 3,
  organizations: 3,
  trainees: 4,
  events: 2,
  videos: 3,
  activity: 4,
} as const;

/** The most items each section shows. */
export const SHOW = {
  programs: 6,
  jobs: 6,
  organizations: 6,
  trainees: 8,
  events: 4,
  videos: 6,
  activity: 8,
} as const;

/**
 * Real items always come first and are never replaced. Labelled samples
 * are only appended while there are fewer than `min` real items, and only
 * as many as it takes to reach `min`. Once a section has `min` real
 * items it shows no samples at all. With placeholders switched off,
 * samples never appear.
 */
export function fillWithSamples<T extends Sampled>(real: T[], samples: T[], min: number, enabled: boolean): T[] {
  if (!enabled || real.length >= min) return real;
  return [...real, ...samples.slice(0, min - real.length)];
}

export function excerpt(text: string | null | undefined, max: number): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 minutes ago", "3 days ago", or a short date for anything over a month. */
export function timeAgo(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = now.getTime() - t;
  if (diff < 0) return "upcoming";
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (diff < 30 * DAY) {
    const d = Math.floor(diff / DAY);
    return `${d} day${d === 1 ? "" : "s"} ago`;
  }
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "Closes in 5 days", "Closes today", or null once it has closed. */
export function closesIn(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t) || t <= now.getTime()) return null;
  const days = Math.ceil((t - now.getTime()) / DAY);
  if (days <= 1) return "Closes today";
  return `Closes in ${days} days`;
}

/**
 * The latest real happenings across the ecosystem, newest first.
 * Events are listed as upcoming rather than dated by their start time,
 * so a far-off event does not push everything else down. Trainees are
 * left out on purpose: a profile being public is the trainee's choice,
 * but announcing each new one is not.
 */
export function buildActivity(real: Pick<LandingReal, "programs" | "jobs" | "organizations" | "videos" | "events">, now: Date = new Date()): ActivityItem[] {
  const items: Array<ActivityItem & { sortAt: number }> = [];
  const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

  for (const p of real.programs) {
    items.push({
      id: `program-${p.id}`, kind: "program", isSample: false, href: p.href, at: p.at, sortAt: ms(p.at),
      text: p.organizationName ? `New program: ${p.title}, by ${p.organizationName}` : `New program: ${p.title}`,
    });
  }
  for (const j of real.jobs) {
    items.push({ id: `job-${j.id}`, kind: "job", isSample: false, href: j.href, at: j.at, sortAt: ms(j.at), text: `${j.company} is hiring: ${j.title}` });
  }
  for (const o of real.organizations) {
    items.push({ id: `org-${o.id}`, kind: "organization", isSample: false, href: o.href, at: o.at, sortAt: ms(o.at), text: `${o.name} joined the ecosystem` });
  }
  for (const v of real.videos) {
    items.push({
      id: `video-${v.card.id}`, kind: "video", isSample: false, href: v.href, at: v.at, sortAt: ms(v.at),
      text: `New video: ${v.card.title}, presented by ${v.card.traineeName}`,
    });
  }
  for (const e of real.events) {
    items.push({ id: `event-${e.id}`, kind: "event", isSample: false, href: e.href, at: e.startsAt, sortAt: now.getTime(), text: `Coming up: ${e.title}, ${e.organizationName}` });
  }
  return items
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, SHOW.activity)
    .map(({ sortAt: _sortAt, ...item }) => item);
}

/** Real content plus labelled placeholders, trimmed to what each section shows. */
export function composeView(real: LandingReal, samples: Pick<LandingReal, "programs" | "jobs" | "organizations" | "trainees" | "events" | "videos"> & { activity: ActivityItem[] }, opts: { placeholders: boolean }, now: Date = new Date()): LandingView {
  const on = opts.placeholders;
  const programs = fillWithSamples(real.programs.slice(0, SHOW.programs), samples.programs, MIN_REAL.programs, on);
  const jobs = fillWithSamples(real.jobs.slice(0, SHOW.jobs), samples.jobs, MIN_REAL.jobs, on);
  const organizations = fillWithSamples(real.organizations.slice(0, SHOW.organizations), samples.organizations, MIN_REAL.organizations, on);
  const trainees = fillWithSamples(real.trainees.slice(0, SHOW.trainees), samples.trainees, MIN_REAL.trainees, on);
  const events = fillWithSamples(real.events.slice(0, SHOW.events), samples.events, MIN_REAL.events, on);
  const videos = fillWithSamples(real.videos.slice(0, SHOW.videos), samples.videos, MIN_REAL.videos, on);
  const activity = fillWithSamples(buildActivity(real, now), samples.activity, MIN_REAL.activity, on);
  const hasSamples = [programs, jobs, organizations, trainees, events, videos, activity].some((list) => list.some((i) => i.isSample));
  return { ...real, programs, jobs, organizations, trainees, events, videos, activity, hasSamples };
}
