"use client";
import { pickActive, type VideoCandidate } from "@/lib/video/activeVideo";

/**
 * Watches the videos on the page while it scrolls and tells each one whether it is the one that should be playing. Only one video
 * is active at a time; the one that scrolls out of view is told to stop. Shared by every video on the page.
 */
interface Entry { el: Element; ratio: number; set: (active: boolean) => void }

const entries = new Map<string, Entry>();
let observer: IntersectionObserver | null = null;
let current: string | null = null;
let seq = 0;

function distanceFromMiddle(el: Element): number {
  const r = el.getBoundingClientRect();
  return Math.abs(r.top + r.height / 2 - window.innerHeight / 2);
}

function recompute() {
  const list: VideoCandidate[] = [...entries.entries()].map(([key, e]) => ({ key, ratio: e.ratio, distance: distanceFromMiddle(e.el) }));
  const next = pickActive(list, current);
  if (next === current) return;
  current = next;
  for (const [key, e] of entries) e.set(key === next);
}

function ensureObserver() {
  if (observer || typeof IntersectionObserver === "undefined") return;
  observer = new IntersectionObserver((changes) => {
    for (const ch of changes) for (const e of entries.values()) if (e.el === ch.target) e.ratio = ch.intersectionRatio;
    recompute();
  }, { threshold: Array.from({ length: 21 }, (_, i) => i / 20) });
  window.addEventListener("resize", recompute);
}

/** Starts watching a video's frame. Returns a function that stops. */
export function watchVideo(el: Element, set: (active: boolean) => void): () => void {
  ensureObserver();
  const key = `v${++seq}`;
  entries.set(key, { el, ratio: 0, set });
  observer?.observe(el);
  return () => {
    observer?.unobserve(el);
    entries.delete(key);
    if (current === key) { current = null; recompute(); }
  };
}

/** Stops every watched video, for example when the page is hidden. */
export function pauseAllWatched() {
  current = null;
  for (const e of entries.values()) e.set(false);
}
