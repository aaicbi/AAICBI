/** The public About page's "which course link is live" answer, remembered for a minute and cleared the moment any growth switch changes. */
export const featuredCache: { at: number; value: { slug: string; title: string } | null } = { at: 0, value: null };
export const FEATURED_TTL_MS = 60_000;
export function clearFeaturedCache() { featuredCache.at = 0; featuredCache.value = null; }
