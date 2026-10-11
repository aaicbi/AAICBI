import { INDUSTRIES } from "@/lib/startups/startupCore";

/**
 * The rules of the ecosystem search with no database, so they can be tested: which kinds of result there are, which filters
 * belong to which kind, how a request is read (never trusting its shape), how a match is ranked, and how links keep the
 * request. The queries themselves are in search.ts and profileSearch.ts.
 */
export const SEARCH_KINDS = ["all", "people", "organizations", "employers", "investors", "startups", "jobs", "programs", "posts", "comments", "videos", "events"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export const KIND_LABEL: Record<SearchKind, string> = {
  all: "All", people: "People", organizations: "Organizations", employers: "Employers", investors: "Investors", startups: "Startups",
  jobs: "Jobs", programs: "Programs", posts: "Posts", comments: "Comments", videos: "Videos", events: "Events",
};

export const SORTS = ["relevance", "recent"] as const;
export type SearchSort = (typeof SORTS)[number];
export const POST_TYPES = ["TEXT", "IMAGE", "YOUTUBE"] as const;
export type PostTypeFilter = (typeof POST_TYPES)[number];
export const POST_TYPE_LABEL: Record<PostTypeFilter, string> = { TEXT: "Text", IMAGE: "Images", YOUTUBE: "Video" };

export const MIN_QUERY = 2;
export const MAX_QUERY = 80;
export const MAX_FILTER = 60;
export const PAGE_SIZE = 12;
/** How many results each kind shows on the "All" tab. */
export const ALL_PREVIEW = 4;
export const MAX_PAGE = 50;

export type FilterKey = "skill" | "location" | "industry" | "type";
/** Which filters make sense for which kind of result. "All" has none; the filters appear once a kind is chosen. */
export const FILTERS_FOR_KIND: Record<SearchKind, FilterKey[]> = {
  all: [], people: ["skill", "location"], organizations: ["location"], employers: [], investors: [], startups: ["industry", "location"],
  jobs: ["skill"], programs: ["industry"], posts: ["type"], comments: [], videos: [], events: [],
};
export const FILTER_LABEL: Record<FilterKey, string> = { skill: "Skill", location: "Location", industry: "Industry or category", type: "Post type" };
export { INDUSTRIES };

export interface SearchParams {
  q: string | null;
  kind: SearchKind;
  skill: string | null;
  location: string | null;
  industry: string | null;
  type: PostTypeFilter | null;
  sort: SearchSort;
  page: number;
}

const clip = (raw: string | undefined, max: number) => {
  const v = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return v.length > 0 ? v : null;
};

/** Trims, collapses spaces and caps the length. Returns null when too short to search. */
export function normalizeQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
  return q.length >= MIN_QUERY ? q : null;
}

export function parseKind(raw: string | null | undefined): SearchKind {
  return (SEARCH_KINDS as readonly string[]).includes(raw ?? "") ? (raw as SearchKind) : "all";
}

/** Reads a request's query string. Anything unknown or out of range falls back to a safe default; nothing here can throw. */
export function parseSearchParams(sp: Record<string, string | string[] | undefined>): SearchParams {
  const one = (k: string) => { const v = sp[k]; return Array.isArray(v) ? v[0] : v; };
  const kind = parseKind(one("kind"));
  const page = Math.max(1, Math.min(MAX_PAGE, Number.parseInt(one("page") ?? "1", 10) || 1));
  const type = (POST_TYPES as readonly string[]).includes(one("type") ?? "") ? (one("type") as PostTypeFilter) : null;
  return {
    q: normalizeQuery(one("q")),
    kind,
    skill: clip(one("skill"), MAX_FILTER),
    location: clip(one("location"), MAX_FILTER),
    industry: clip(one("industry"), MAX_FILTER),
    type,
    sort: (SORTS as readonly string[]).includes(one("sort") ?? "") ? (one("sort") as SearchSort) : "relevance",
    page,
  };
}

/** A search can run on a word, on a filter alone ("everyone who lists Python"), or on both. */
export function hasCriteria(p: Pick<SearchParams, "q" | "skill" | "location" | "industry" | "type">): boolean {
  return !!(p.q || p.skill || p.location || p.industry || p.type);
}

/** The filters that apply to the chosen kind and are set. */
export function activeFilters(p: SearchParams): FilterKey[] {
  return FILTERS_FOR_KIND[p.kind].filter((k) => p[k]);
}

/** A link to a search, keeping what is set and changing what is asked. Empty and default values are left out of the address. */
export function searchHref(p: SearchParams, change: { [K in keyof SearchParams]?: SearchParams[K] } = {}): string {
  const n: SearchParams = { ...p, ...change };
  const qs = new URLSearchParams();
  if (n.q) qs.set("q", n.q);
  if (n.kind !== "all") qs.set("kind", n.kind);
  for (const k of FILTERS_FOR_KIND[n.kind]) if (n[k]) qs.set(k, n[k] as string);
  if (n.sort !== "relevance") qs.set("sort", n.sort);
  if (n.page > 1) qs.set("page", String(n.page));
  const s = qs.toString();
  return s ? `/search?${s}` : "/search";
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/**
 * How well some text matches a word, from 0 (not at all) up. The first field is the name, which matters most:
 * an exact name beats a name that starts with the word, which beats a word inside the name, which beats a match in
 * any of the other fields (tagline, location, skills and so on).
 */
export function rankText(query: string, fields: Array<string | null | undefined>): number {
  const q = norm(query.trim().replace(/^[@#]/, ""));
  if (!q) return 0;
  let best = 0;
  fields.forEach((raw, i) => {
    if (!raw) return;
    const t = norm(raw);
    const weight = i === 0 ? 1 : 0.5;
    let s = 0;
    if (t === q) s = 100;
    else if (t.startsWith(q)) s = 80;
    else if (new RegExp(`(^|[^a-z0-9])${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t)) s = 60;
    else if (t.includes(q)) s = 40;
    best = Math.max(best, s * weight);
  });
  return best;
}

/** Orders hits: by relevance (best first, newest among equals) or simply newest first. */
export function orderHits<T extends { rank: number; at: number }>(hits: T[], sort: SearchSort): T[] {
  return [...hits].sort((a, b) => (sort === "recent" ? b.at - a.at : b.rank - a.rank || b.at - a.at));
}

/** One page of an ordered list, and whether another page follows. */
export function pageOf<T>(items: T[], page: number, size = PAGE_SIZE): { items: T[]; hasMore: boolean } {
  const start = (page - 1) * size;
  return { items: items.slice(start, start + size), hasMore: items.length > start + size };
}
