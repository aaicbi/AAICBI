/** Shown while a search runs: the same shape as the results, so the page does not jump when they arrive. */
export default function SearchLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Searching…</span>
      <div className="h-8 w-32 animate-pulse rounded-lg bg-brand-mint" />
      <div className="mt-4 h-24 animate-pulse rounded-3xl bg-brand-mint" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-brand-mint" />)}
      </div>
    </main>
  );
}
