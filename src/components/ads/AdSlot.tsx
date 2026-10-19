"use client";
import { useEffect, useState } from "react";
import SponsoredCard from "@/components/ads/SponsoredCard";
import PlayCardBanner from "@/components/landing/PlayCardBanner";
import type { PublicAd } from "@/lib/ads/ads";

/**
 * A fixed place for one ad: the top of the feed or the About page. Shows a paid ad when one is live, otherwise our own play card
 * (when the Super Admin leaves that on), otherwise nothing at all. `src` is the page it appears on, for the funnel's source tracking.
 */
export default function AdSlot({ placement, src, compact = false, className = "" }: { placement: "top" | "about"; src: string; compact?: boolean; className?: string }) {
  const [state, setState] = useState<{ ad: PublicAd | null; house: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/public/ads?placement=${placement}&count=1&src=${encodeURIComponent(src)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live && j) setState({ ad: j.ads?.[0] ?? null, house: !!j.house }); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [placement, src]);
  if (!state) return null;
  if (state.ad) return <div className={`${className} ${placement === "about" ? "px-6 pb-14" : "mb-4"}`} data-testid="ad-slot"><div className="mx-auto max-w-xl"><SponsoredCard ad={state.ad} /></div></div>;
  if (state.house) return <PlayCardBanner src={src} compact={compact} />;
  return null;
}
