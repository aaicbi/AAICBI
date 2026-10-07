/** Pure feed and ranking rules — no database access, so they are unit-tested. */

export const FEED_FILTERS = ["all", "learn", "organizations", "jobs", "projects"] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];
export type FeedType = "learn" | "organization" | "job" | "project";

export const FEED_FILTER_LABEL: Record<FeedFilter, string> = {
  all: "All",
  learn: "Learn",
  organizations: "Organizations",
  jobs: "Jobs",
  projects: "Projects",
};

const FILTER_TO_TYPE: Record<Exclude<FeedFilter, "all">, FeedType> = {
  learn: "learn",
  organizations: "organization",
  jobs: "job",
  projects: "project",
};

export function parseFeedFilter(raw: string | undefined): FeedFilter {
  return (FEED_FILTERS as readonly string[]).includes(raw ?? "") ? (raw as FeedFilter) : "all";
}

export function typesForFilter(filter: FeedFilter): FeedType[] {
  return filter === "all" ? ["learn", "organization", "job", "project"] : [FILTER_TO_TYPE[filter]];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Trending Education score. Counts go through log1p so a hundred views
 * or likes are not a hundred times better than one: flooding a video
 * with repeat activity barely moves it. Saves and likes (deliberate
 * actions) outweigh views; the whole thing decays with age so last
 * quarter's hit does not sit on top forever.
 */
export function trendingScore(input: { views: number; likes: number; saves: number; ageDays: number }): number {
  const engagement = Math.log1p(Math.max(0, input.views)) + 3 * Math.log1p(Math.max(0, input.likes)) + 4 * Math.log1p(Math.max(0, input.saves));
  const recency = 1 / (1 + Math.max(0, input.ageDays) / 14);
  return engagement * recency;
}

/** Keeps at most `maxPerGroup` items per group, preserving order — stops one organization owning the whole list. */
export function diversify<T>(items: T[], groupOf: (item: T) => string, maxPerGroup: number): T[] {
  const counts = new Map<string, number>();
  const out: T[] = [];
  for (const item of items) {
    const g = groupOf(item);
    const n = counts.get(g) ?? 0;
    if (n >= maxPerGroup) continue;
    counts.set(g, n + 1);
    out.push(item);
  }
  return out;
}

export interface FeedEntry {
  key: string;
  type: FeedType;
  at: Date;
  /** True when the viewer follows the organization behind this item. */
  followed?: boolean;
}

/** Items from followed organizations float up by this much. */
export const FOLLOW_BOOST_MS = 3 * DAY_MS;
/** No more than this many items of one type in a row. */
export const MAX_TYPE_RUN = 3;

/**
 * Orders a mixed feed: newest first, followed organizations boosted, and
 * no long runs of one type so the feed stays varied ("feels alive").
 */
export function rankFeed<T extends FeedEntry>(entries: T[], limit: number): T[] {
  const score = (e: T) => e.at.getTime() + (e.followed ? FOLLOW_BOOST_MS : 0);
  const remaining = [...entries].sort((a, b) => score(b) - score(a) || a.key.localeCompare(b.key));
  const out: T[] = [];
  while (remaining.length > 0 && out.length < limit) {
    const last = out.slice(-MAX_TYPE_RUN);
    const runIsFull = last.length === MAX_TYPE_RUN && last.every((e) => e.type === last[0].type);
    let idx = 0;
    if (runIsFull) {
      const other = remaining.findIndex((e) => e.type !== last[0].type);
      if (other >= 0) idx = other;
    }
    out.push(remaining.splice(idx, 1)[0]);
  }
  return out;
}
