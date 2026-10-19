"use client";
import { useEffect, useState } from "react";

/**
 * The animated play card on the public pages: a looping, softly glowing card that opens the free taster. It asks which course link is live
 * right now, so it appears and disappears as soon as a campaign is switched on or off, and shows nothing at all when none is live.
 * People who ask their device for less motion see the still card instead of the video.
 */
export default function PlayCardBanner({ src }: { src: string }) {
  const [play, setPlay] = useState<{ link: string; title: string } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/public/growth/featured?src=${encodeURIComponent(src)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!live || !j?.live) return;
        // On our own site the link stays on whatever address the visitor is already on (the live site, a preview, a local copy).
        let href: string = j.link;
        try { const u = new URL(j.link); href = `${u.pathname}${u.search}`; } catch { /* keep as given */ }
        setPlay({ link: href, title: j.title });
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [src]);
  if (!play) return null;
  return (
    <section className="px-6 pb-14" aria-labelledby="play-card-h" data-testid="play-card-banner">
      <div className="mx-auto max-w-3xl text-center">
        <h2 id="play-card-h" className="font-display text-2xl font-semibold text-brand-ink sm:text-3xl">Think you think like an AI automation builder?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-gray-600">Take the free challenge from {play.title}. Five questions, ninety seconds, no sign-up. See your rank, then start Module 1 free.</p>
        <a href={play.link} aria-label={`Play the free 90-second challenge from ${play.title}`} data-testid="play-card-link"
          className="group relative mx-auto mt-6 block w-full overflow-hidden rounded-3xl shadow-[0_0_0_2px_rgba(242,184,75,0.65),0_22px_60px_-18px_rgba(6,50,45,0.6)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_0_0_2px_rgba(242,184,75,1),0_28px_70px_-16px_rgba(242,184,75,0.45)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
          style={{ aspectRatio: "1200 / 630" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/growth/play-card.png" alt="" className="absolute inset-0 h-full w-full object-cover" data-testid="play-card-still" />
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden" autoPlay muted loop playsInline preload="metadata" poster="/growth/play-card.png" aria-hidden="true" tabIndex={-1} data-testid="play-card-video">
            <source src="/growth/play-card.mp4" type="video/mp4" />
            <source src="/growth/play-card.webm" type="video/webm" />
          </video>
        </a>
        <p className="mt-4 text-sm font-semibold text-brand-ink">Tap the card to play.</p>
        <a href={play.link} className="mt-3 inline-flex min-h-[52px] items-center justify-center rounded-full bg-brand-gold px-8 text-base font-extrabold text-brand-onGold hover:opacity-90" data-testid="play-card-button">Play now, it&apos;s free</a>
      </div>
    </section>
  );
}
