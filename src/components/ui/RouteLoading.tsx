import { SkeletonLine, SkeletonList } from "@/components/ui/Skeleton";

/**
 * The route-level loading state. Next shows a segment's loading.tsx the
 * moment a navigation starts, while the server renders the next page,
 * so a click on a sidebar link answers immediately instead of the old
 * page just sitting there. Mirrors the shape of a typical page (title
 * line, subtitle line, a few cards) so the swap to real content does
 * not jump. role="status" plus the visually hidden text gives screen
 * readers the same signal.
 */
export default function RouteLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6" aria-busy="true">
      <div role="status">
        <span className="sr-only">Loading</span>
        <div className="space-y-2">
          <div className="h-7 w-56 animate-pulse rounded-lg bg-brand-gray/60" />
          <SkeletonLine width="38%" />
        </div>
        <div className="mt-8">
          <SkeletonList rows={3} />
        </div>
      </div>
    </main>
  );
}
