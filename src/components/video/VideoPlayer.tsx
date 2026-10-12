"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Play, X } from "lucide-react";
import ControlledYouTube from "@/components/video/ControlledYouTube";
import { watchVideo } from "@/lib/video/activity";
import Icon from "@/components/ui/Icon";
import { EMBED_ALLOW, embedSrc, posterUrl, type VideoSource } from "@/lib/video/embed";

interface Props {
  source: VideoSource;
  title: string;
  /** Skip the poster picture until the viewer taps play (low-bandwidth mode). */
  lowBandwidthMode?: boolean;
  className?: string;
  /**
   * Feed and post pages: the video that is most on screen plays by itself, muted, grows a little while it plays, and pauses when
   * you scroll on to another. Not used where learners expect to press play themselves (course lessons).
   */
  autoplayInView?: boolean;
  /** Negative margins that let the playing video reach the edges of the card it sits in. */
  bleedClass?: string;
}

function Frame({ source, title, autoplay }: { source: VideoSource; title: string; autoplay: boolean }) {
  return (
    <iframe
      src={embedSrc(source, { autoplay })}
      title={title}
      className="absolute inset-0 h-full w-full"
      allow={EMBED_ALLOW}
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

/** A large centered player over a dimmed page. Esc, the backdrop and the close button all return to the page exactly where it was. */
function VideoModal({ source, title, onClose }: { source: VideoSource; title: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind keeps its scroll position
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-3 sm:p-6 print:hidden" onClick={onClose}>
      <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-3 text-white">
          <p className="line-clamp-1 break-words text-sm font-semibold">{title}</p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close video"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-semibold hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Icon icon={X} size="sm" /> Close
          </button>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
          {source.kind === "youtube" ? <ControlledYouTube id={source.id} title={title} active /> : <Frame source={source} title={title} autoplay />}
        </div>
      </div>
    </div>
  );
}

/**
 * Course video, kept inside the platform. A 16:9 poster with a play button
 * loads nothing from YouTube until tapped (good for data and speed); tapping
 * plays it right there in an embedded player with its own fullscreen button.
 * "Expand" opens the same video much larger in a modal. Nothing here links
 * out to youtube.com, so the YouTube app is never launched.
 */
export default function VideoPlayer({ source, title, lowBandwidthMode = false, className = "", autoplayInView = false, bleedClass = "" }: Props) {
  const [started, setStarted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [managedActive, setManagedActive] = useState(false);
  const [forced, setForced] = useState(false);
  const [autoAllowed, setAutoAllowed] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const poster = posterUrl(source);
  const showPoster = !lowBandwidthMode && !posterFailed && poster;
  const closeModal = useCallback(() => setExpanded(false), []);
  const isYouTube = source.kind === "youtube";

  // Autoplay only when asked for, and never in low-data mode, with data saver on, or for people who ask their device for less motion.
  useEffect(() => {
    if (!autoplayInView || !isYouTube || lowBandwidthMode) return setAutoAllowed(false);
    const saver = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    const calm = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setAutoAllowed(!saver && !calm);
  }, [autoplayInView, isYouTube, lowBandwidthMode]);

  // While autoplay is on, the page decides which video plays.
  useEffect(() => {
    if (!autoAllowed || !frame.current) return;
    return watchVideo(frame.current, setManagedActive);
  }, [autoAllowed]);
  useEffect(() => { if (autoAllowed && managedActive) setStarted(true); }, [autoAllowed, managedActive]);
  // Someone who taps play on a video before the page has picked it keeps it playing until it scrolls away.
  useEffect(() => { if (!managedActive) return; return () => setForced(false); }, [managedActive]);

  const playing = started && isYouTube;
  const active = autoAllowed ? (managedActive || forced) && !expanded : !expanded;
  const grow = autoAllowed && managedActive && started;
  const sizing = autoAllowed ? `w-auto transition-[margin,border-radius] duration-300 motion-reduce:transition-none ${grow ? `${bleedClass} rounded-lg` : "mx-3 rounded-xl sm:mx-4"}` : "w-full rounded-xl";

  return (
    <div ref={frame} data-testid="video-frame" data-active={grow ? "true" : "false"} className={`relative aspect-video overflow-hidden border border-brand-gray bg-black shadow-md ${sizing} ${className}`}>
      {playing ? (
        <ControlledYouTube id={source.id} title={title} active={active} onFullscreen={() => setExpanded(true)} />
      ) : started && !isYouTube ? (
        <Frame source={source} title={title} autoplay />
      ) : (
        <button type="button" onClick={() => { setStarted(true); setForced(true); }} aria-label={`Play video: ${title}`} className="group absolute inset-0 block h-full w-full cursor-pointer bg-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white">
          {showPoster ? (
            // eslint-disable-next-line @next/next/no-img-element -- a video poster served by YouTube/Drive, not a local asset.
            <img src={poster as string} alt="" loading="lazy" decoding="async" onError={() => setPosterFailed(true)} className="h-full w-full object-cover opacity-90 transition duration-300 group-hover:opacity-100" />
          ) : null}
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/65 ring-1 ring-white/30 transition-transform group-hover:scale-110 sm:h-20 sm:w-20">
              <Icon icon={Play} size="xl" className="ml-1" />
            </span>
            {!showPoster && <span className="text-xs text-white/80">Tap to play video</span>}
          </span>
        </button>
      )}
      {!started && (
        <button type="button" onClick={() => setExpanded(true)} aria-label={`Expand video: ${title}`} className="absolute right-2 top-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <Icon icon={Maximize2} size="md" />
        </button>
      )}
      {expanded && <VideoModal source={source} title={title} onClose={closeModal} />}
    </div>
  );
}
