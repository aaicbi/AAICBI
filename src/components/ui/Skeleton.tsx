/**
 * Replaces plain "Loading..." text (17 instances across this app) with
 * a placeholder that mirrors the actual layout. Doesn't make anything
 * load faster — makes it FEEL faster, which is most of what matters
 * for perceived performance on a data-fetching page.
 */
export function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <div className="h-3.5 animate-pulse rounded-full bg-brand-gray/60" style={{ width }} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-brand-gray p-5">
      <SkeletonLine width="40%" />
      <div className="mt-3 space-y-2">
        <SkeletonLine width="90%" />
        <SkeletonLine width="70%" />
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonTableRows({ rows = 4, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-gray-100">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="py-3">
              <SkeletonLine width={c === 0 ? "70%" : "40%"} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
