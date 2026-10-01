"use client";
import { useEffect } from "react";
import { trackVisitorEvent } from "@/lib/analytics/visitorTrackClient";

/**
 * Analytics System Phase 2 — a tiny client island for a page view
 * tracking hook where the page itself is a SERVER component (the
 * landing page) with no client lifecycle of its own to attach to.
 * Renders nothing; fires once on mount.
 */
export default function VisitorTracker({ path }: { path: string }) {
  useEffect(() => {
    trackVisitorEvent({ type: "PAGE_VIEWED", path });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
