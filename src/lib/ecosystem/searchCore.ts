export const SEARCH_KINDS = ["all", "organizations", "videos", "programs", "events"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export const MIN_QUERY = 2;
export const MAX_QUERY = 80;

/** Trims, collapses spaces and caps the length. Returns null when too short to search. */
export function normalizeQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
  return q.length >= MIN_QUERY ? q : null;
}

export function parseKind(raw: string | null | undefined): SearchKind {
  return (SEARCH_KINDS as readonly string[]).includes(raw ?? "") ? (raw as SearchKind) : "all";
}
