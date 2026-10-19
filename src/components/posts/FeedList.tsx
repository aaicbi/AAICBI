"use client";
import { useEffect, useState } from "react";
import SponsoredCard from "@/components/ads/SponsoredCard";
import { INLINE_EVERY, adForSlot } from "@/lib/ads/adsCore";
import type { PublicAd } from "@/lib/ads/ads";
import PostItem from "@/components/posts/PostItem";
import Button from "@/components/ui/Button";
import type { FeedPost } from "@/lib/posts/interactions";

/** A page of posts, with "Show more" that fetches the next page (the cursor keeps the order steady when new posts arrive). */
export default function FeedList({ initial, next, tab, tag }: { initial: FeedPost[]; next: string | null; tab: "latest" | "following"; tag?: string | null }) {
  const [posts, setPosts] = useState(initial);
  const [cursor, setCursor] = useState(next);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ads, setAds] = useState<PublicAd[]>([]);
  // Sponsored cards between posts, fetched once; none when ads are off or none are live.
  useEffect(() => {
    let live = true;
    fetch("/api/public/ads?placement=inline&count=4").then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j?.ads) setAds(j.ads); }).catch(() => undefined);
    return () => { live = false; };
  }, []);

  async function more() {
    setBusy(true); setFailed(false);
    const q = new URLSearchParams({ tab, cursor: cursor ?? "", ...(tag ? { tag } : {}) });
    const r = await fetch(`/api/feed?${q}`).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setFailed(true);
    const d = await r.json();
    setPosts((p) => [...p, ...d.posts.filter((x: FeedPost) => !p.some((y) => y.id === x.id))]);
    setCursor(d.next);
  }

  return (
    <div>
      <ul className="space-y-4">{posts.map((p, i) => {
        const ad = (i + 1) % INLINE_EVERY === 0 ? adForSlot(ads, (i + 1) / INLINE_EVERY - 1) : null;
        return (
          <li key={p.id} className="space-y-4">
            <PostItem post={p} />
            {ad && <div data-testid="inline-ad"><SponsoredCard ad={ad} /></div>}
          </li>
        );
      })}</ul>
      {cursor && <div className="mt-6 text-center"><Button variant="secondary" onClick={more} loading={busy}>Show more posts</Button>{failed && <p className="mt-2 text-sm text-brand-rose" role="alert">Could not load more. Try again.</p>}</div>}
    </div>
  );
}
