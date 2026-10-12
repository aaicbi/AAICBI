"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Play, Volume2, VolumeX } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { playerVars } from "@/lib/video/embed";
import { progressFraction } from "@/lib/video/activeVideo";
import { isSoundOn, setSoundOn } from "@/lib/video/sound";
import { loadYouTubeApi, YT_STATE, type YTPlayer } from "@/lib/video/youtubeApi";

/**
 * A YouTube video with the platform's own controls instead of YouTube's: the player's bar, title and buttons are switched off and
 * the frame cannot be clicked, so the only things on it are tap to play or pause, a raised speaker button for sound, a thin
 * progress bar and a full screen button. `active` says whether it should be playing right now (the page decides, by what is on
 * screen). It starts muted so a phone allows it; once someone turns the sound on, later videos start with sound.
 */
export default function ControlledYouTube({ id, title, active, onFullscreen, className = "" }: { id: string; title: string; active: boolean; onFullscreen?: () => void; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const userPaused = useRef(false);
  const wantPlay = useRef(active);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(!isSoundOn());
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(true);

  const play = useCallback(() => {
    const p = player.current; if (!p) return;
    p.playVideo();
    // A browser may refuse to start a video with sound by itself; if so, start it muted.
    if (isSoundOn()) window.setTimeout(() => {
      const st = player.current?.getPlayerState();
      if (wantPlay.current && st !== YT_STATE.PLAYING && st !== YT_STATE.BUFFERING) { player.current?.mute(); setMuted(true); player.current?.playVideo(); }
    }, 900);
  }, []);

  // Create the player once.
  useEffect(() => {
    let dead = false;
    const el = document.createElement("div");
    box.current?.appendChild(el);
    loadYouTubeApi().then((YT) => {
      if (dead) return;
      const startMuted = true; // always start muted so a phone allows it; sound is restored as soon as it is ready
      const p = new YT.Player(el, {
        videoId: id,
        host: "https://www.youtube-nocookie.com",
        playerVars: { ...playerVars({ autoplay: wantPlay.current, mute: startMuted }), origin: window.location.origin },
        events: {
          onReady: () => {
            if (dead) return;
            player.current = p;
            if (isSoundOn()) { p.unMute(); setMuted(false); }
            setReady(true);
            if (wantPlay.current && !userPaused.current) play();
          },
          onStateChange: (e) => {
            if (dead) return;
            if (e.data === YT_STATE.PLAYING) setPlaying(true);
            else if (e.data === YT_STATE.PAUSED || e.data === YT_STATE.CUED) setPlaying(false);
            else if (e.data === YT_STATE.ENDED) { setPlaying(false); setProgress(0); p.seekTo(0, true); p.pauseVideo(); }
          },
          onError: () => { if (!dead) setFailed(true); },
        },
      });
    }).catch(() => { if (!dead) setFailed(true); });
    return () => { dead = true; try { player.current?.destroy(); } catch { /* already gone */ } player.current = null; el.remove(); };
  }, [id, play]);

  // The page says whether this video is the one to play. Scrolling past it pauses it; coming back resumes it.
  useEffect(() => {
    wantPlay.current = active;
    const p = player.current;
    if (!ready || !p) return;
    if (active) { if (!userPaused.current) play(); }
    else { p.pauseVideo(); userPaused.current = false; }
  }, [active, ready, play]);

  // Pause when the tab is hidden.
  useEffect(() => {
    const onHide = () => { if (document.hidden) player.current?.pauseVideo(); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  // Progress bar.
  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => { const p = player.current; if (p) setProgress(progressFraction(p.getCurrentTime(), p.getDuration())); }, 250);
    return () => window.clearInterval(t);
  }, [playing]);

  // The "tap for sound" hint goes away on its own.
  useEffect(() => { const t = window.setTimeout(() => setHint(false), 4000); return () => window.clearTimeout(t); }, []);

  function toggleSound(e: React.MouseEvent) {
    e.stopPropagation();
    const p = player.current; if (!p) return;
    if (muted) { p.unMute(); setMuted(false); setSoundOn(true); } else { p.mute(); setMuted(true); setSoundOn(false); }
    setHint(false);
  }
  function togglePlay() {
    const p = player.current; if (!p) return;
    if (playing) { userPaused.current = true; p.pauseVideo(); } else { userPaused.current = false; play(); }
  }
  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const p = player.current; const d = p?.getDuration() ?? 0; if (!p || d <= 0) return;
    const f = Number(e.target.value) / 1000; p.seekTo(f * d, true); setProgress(f);
  }

  return (
    <div className={`absolute inset-0 bg-black ${className}`}>
      {/* The player's frame fills the box and ignores the pointer, so none of YouTube's own buttons can be reached. */}
      <div ref={box} data-testid="yt-frame" className="absolute inset-0 [&_iframe]:pointer-events-none [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
      {failed ? (
        <p role="alert" className="absolute inset-0 flex items-center justify-center bg-black/80 px-4 text-center text-sm text-white">This video could not be loaded. Check your connection and try again.</p>
      ) : (
        <>
          <button type="button" onClick={togglePlay} aria-label={playing ? `Pause video: ${title}` : `Play video: ${title}`} className="group absolute inset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white">
            {!playing && ready && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/65 text-white ring-1 ring-white/30 sm:h-20 sm:w-20"><Icon icon={Play} size="xl" className="ml-1" /></span>
              </span>
            )}
          </button>
          <button type="button" onClick={toggleSound} aria-label={muted ? "Turn sound on" : "Turn sound off"} aria-pressed={!muted} data-testid="yt-sound"
            className="absolute bottom-4 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-white/30 to-black/70 text-white shadow-[0_3px_8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_3px_rgba(0,0,0,0.45)] ring-1 ring-white/50 transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Icon icon={muted ? VolumeX : Volume2} size="md" />
          </button>
          {muted && hint && ready && (
            <span aria-hidden="true" className="pointer-events-none absolute bottom-[1.15rem] right-16 z-10 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">Tap for sound</span>
          )}
          {onFullscreen && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onFullscreen(); }} aria-label={`Full screen: ${title}`} className="absolute right-2 top-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <Icon icon={Maximize2} size="md" />
            </button>
          )}
          {ready && (
            <div className="absolute inset-x-0 bottom-0 z-10 h-3 cursor-pointer">
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25"><div data-testid="yt-progress" className="h-full bg-white" style={{ width: `${progress * 100}%` }} /></div>
              <input type="range" min={0} max={1000} value={Math.round(progress * 1000)} onChange={seek} aria-label="Seek" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
