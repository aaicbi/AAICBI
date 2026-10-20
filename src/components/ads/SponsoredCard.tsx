"use client";
import { useEffect, useRef } from "react";
import type { PublicAd } from "@/lib/ads/ads";
import { useLiteConnection } from "@/lib/useLiteConnection";

const seenKey = (id: string) => `ad-seen:${id}:${new Date().toISOString().slice(0, 10)}`;

/**
 * One sponsored card: the advertiser's logo and name, a "Sponsored" label, the picture or looping video, a headline, a line of text and a button.
 * A view is counted once the card has been at least half on screen for a second, once per ad per day in this browser. `preview` (the admin form) never counts.
 * People who ask for less motion see the first frame of a video instead of it playing.
 */
export default function SponsoredCard({ ad, preview = false }: { ad: PublicAd; preview?: boolean }) {
  const box = useRef<HTMLElement>(null);
  const lite = useLiteConnection();
  useEffect(() => {
    if (preview || !box.current || typeof IntersectionObserver === "undefined") return;
    try { if (localStorage.getItem(seenKey(ad.id))) return; } catch { /* storage may be blocked */ }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver((entries) => {
      const on = entries[0]?.isIntersecting;
      if (on && !timer) {
        timer = setTimeout(() => {
          io.disconnect();
          try { localStorage.setItem(seenKey(ad.id), "1"); } catch { /* ignore */ }
          fetch(`/api/public/ads/${ad.id}/view`, { method: "POST", keepalive: true }).catch(() => undefined);
        }, 1000);
      } else if (!on && timer) { clearTimeout(timer); timer = undefined; }
    }, { threshold: 0.5 });
    io.observe(box.current);
    return () => { io.disconnect(); if (timer) clearTimeout(timer); };
  }, [ad.id, preview]);

  const { advertiser: a } = ad;
  const href = preview ? "#" : ad.goUrl;
  return (
    <article ref={box} className="overflow-hidden rounded-3xl border border-brand-gray bg-brand-surface shadow-sm" data-testid="sponsored-card" data-ad-id={ad.id} aria-label={`Sponsored: ${ad.headline}`}>
      <header className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-mint text-sm font-extrabold text-brand-ink">
          {a.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img loading="lazy" decoding="async" src={a.logoUrl} alt="" className="h-full w-full object-cover" /> : a.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-brand-ink" data-testid="sponsored-name">{a.name}</span>
          {a.kind && <span className="block truncate text-xs text-gray-600">{a.kind}</span>}
        </span>
        <span className="shrink-0 rounded-full border border-brand-ink px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-brand-ink" data-testid="sponsored-label">Sponsored</span>
      </header>
      {ad.media.kind === "VIDEO" && lite ? (
        // Slow or data-saver connection: nothing downloads until the person presses play (the controls sit outside the link).
        <div className="bg-black" data-testid="sponsored-media">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video className="aspect-video w-full object-cover" src={ad.media.url} controls muted playsInline preload="none" aria-label={ad.headline} />
        </div>
      ) : (
        <a href={href} target={preview ? undefined : "_blank"} rel="sponsored noopener noreferrer" onClick={preview ? (e) => e.preventDefault() : undefined} aria-label={`${ad.headline} (opens in a new tab)`} className="block bg-black" data-testid="sponsored-media">
          {ad.media.kind === "VIDEO" ? (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video className="aspect-video w-full object-cover motion-reduce:hidden" src={`${ad.media.url}#t=0.1`} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />
              {/* Reduced motion: the still first frame, with the video paused. */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video className="hidden aspect-video w-full object-cover motion-reduce:block" src={`${ad.media.url}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />
            </>
          ) : /* eslint-disable-next-line @next/next/no-img-element */ <img src={ad.media.url} alt="" loading="lazy" decoding="async" className="aspect-video w-full object-cover" />}
        </a>
      )}
      <div className="space-y-3 p-4">
        <p className="font-display text-lg font-semibold leading-snug text-brand-ink">{ad.headline}</p>
        <p className="text-sm leading-relaxed text-gray-700">{ad.caption}</p>
        <a href={href} target={preview ? undefined : "_blank"} rel="sponsored noopener noreferrer" onClick={preview ? (e) => e.preventDefault() : undefined} className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-brand-gold px-6 text-sm font-extrabold text-brand-onGold hover:opacity-90" data-testid="sponsored-button">{ad.buttonLabel}</a>
      </div>
    </article>
  );
}
