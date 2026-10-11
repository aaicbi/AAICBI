import { unstable_cache } from "next/cache";
import { feedPage, suggestions, trendingTags } from "@/lib/posts/interactions";

/**
 * What a visitor without an account sees is the same for everyone, so the first page of the feed, the trending
 * topics and the suggestions are kept for a short time instead of being rebuilt for every visitor. Signed-in people
 * never use these: they get their own, uncached view. A post that is approved, blocked or removed clears the feed
 * entry at once (see feedCache.ts); the rest refreshes on its own.
 */
export const publicFeedFirstPage = unstable_cache(() => feedPage({ tab: "latest", actor: null }), ["public-feed-first-page"], { revalidate: 60, tags: ["public-feed"] });
export const publicTrendingTags = unstable_cache(() => trendingTags(), ["public-trending-tags"], { revalidate: 300, tags: ["public-feed"] });
export const publicSuggestions = unstable_cache(() => suggestions(null, 4), ["public-suggestions"], { revalidate: 300 });
