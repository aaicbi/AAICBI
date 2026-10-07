"use client";
import "./globals.css";

/**
 * Last-resort boundary: catches an error thrown by the root layout
 * itself, where nothing else (including the normal error.tsx files)
 * can render. It replaces the root layout, so it must supply its own
 * <html> and <body>.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-brand-ink">AAICBI is having trouble</h1>
          <p className="mt-2 text-sm text-gray-600">
            Something went wrong while loading the page. Try again in a moment.
          </p>
          {error.digest && <p className="mt-3 text-xs text-gray-600">Reference: {error.digest}</p>}
          <button
            onClick={reset}
            className="mt-6 rounded-lg bg-brand-teal px-4 py-2.5 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
