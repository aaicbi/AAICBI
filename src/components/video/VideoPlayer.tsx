"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Play, X } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { EMBED_ALLOW, embedSrc, posterUrl, type VideoSource } from "@/lib/video/embed";

interface Props {
  source: VideoSource;
  title: string;
  /** Skip the poster picture until the viewer taps play (low-bandwidth mode). */
  lowBandwidthMode?: boolean;
  className?: string;
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
          <Frame source={source} title={title} autoplay />
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
export default function VideoPlayer({ source, title, lowBandwidthMode = false, className = "" }: Props) {
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const poster = posterUrl(source);
  const showPoster = !lowBandwidthMode && !posterFailed && poster;
  const closeModal = useCallback(() => setExpanded(false), []);

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-xl border border-brand-gray bg-black shadow-md ${className}`}>
      {playing && !expanded ? (
        <Frame source={source} title={title} autoplay />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} aria-label={`Play video: ${title}`} className="group absolute inset-0 block h-full w-full cursor-pointer bg-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal">
          {showPoster ? (
            // eslint-disable-next-line @next/next/no-img-element -- a video poster served by YouTube/Drive, not a local asset.
            <img src={poster as string} alt="" loading="lazy" decoding="async" onError={() => setPosterFailed(true)} className="h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-[1.02] group-hover:opacity-75" />
          ) : null}
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/65 ring-1 ring-white/30 transition-transform group-hover:scale-110 sm:h-20 sm:w-20">
              <Icon icon={Play} size="xl" className="ml-1" />
            </span>
            {!showPoster && <span className="text-xs text-white/80">Tap to play video</span>}
          </span>
        </button>
      )}
      {!playing && (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={`Expand video: ${title}`}
        className="absolute right-2 top-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Icon icon={Maximize2} size="md" />
      </button>
      )}
      {expanded && <VideoModal source={source} title={title} onClose={closeModal} />}
    </div>
  );
}
