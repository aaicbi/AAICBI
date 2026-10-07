"use client";
import { useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

/**
 * The route-level error state, shared by every segment's error.tsx.
 * Replaces the framework's unbranded default error screen. Gives the
 * user a real retry (Next's reset re-renders the failed segment) and a
 * way back, and never prints the underlying error: the digest is
 * shown so support can find the matching server log line.
 */
export default function RouteError({
  error,
  reset,
  homeHref,
  homeLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref: string;
  homeLabel: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">This page could not load</h1>
      <p className="mt-2 text-sm text-gray-600">
        Something went wrong on our side. Try again, and if it keeps happening, go back and contact support with the
        reference below.
      </p>
      {error.digest && <p className="mt-3 text-xs text-gray-600">Reference: {error.digest}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button href={homeHref} variant="secondary">
          {homeLabel}
        </Button>
      </div>
    </main>
  );
}
