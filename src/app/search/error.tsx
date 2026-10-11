"use client";

/** If a search fails, say so plainly and let the person try again; nothing about the failure is shown. */
export default function SearchError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <h1 className="font-display text-xl font-semibold text-brand-ink">We could not run that search</h1>
      <p className="mt-2 text-sm text-gray-800">Something went wrong on our side. Your connection is fine. Please try again in a moment.</p>
      <button type="button" onClick={reset} className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-teal px-6 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep">Try again</button>
    </main>
  );
}
