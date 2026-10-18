"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import "./arena.css";
import { wake } from "./sound";

/** The full-screen landscape frame shared by the lobby and the match: title, sound, rotate / flip / fullscreen. */
export default function ArenaFrame({ title, backHref, sound, onSound, children }: {
  title: string; backHref: string; sound?: boolean; onSound?: (on: boolean) => void; children: ReactNode;
}) {
  const [flipped, setFlipped] = useState(false);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const prev = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const f = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => { document.body.style.overflow = prev; document.documentElement.style.overflow = prevHtml; document.removeEventListener("fullscreenchange", f); };
  }, []);
  const toggleFull = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.();
      // Phones that allow it: lock to landscape once fullscreen.
      void (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.("landscape")?.catch(() => undefined);
    } catch { /* not supported */ }
  };
  return (
    <div className={`ar-root${flipped ? " ar-flipped" : ""}`} onPointerDown={wake}>
      <div className="ar-bar">
        <Link href={backHref} aria-label="Leave the arena screen">← Back</Link>
        <h1>{title}</h1>
        {onSound && <button type="button" aria-pressed={!!sound} onClick={() => onSound(!sound)}>{sound ? "🔊 Ticking on" : "🔈 Ticking off"}</button>}
        <button type="button" className="ar-flipbtn" onClick={() => setFlipped((v) => !v)}>Flip screen</button>
        <button type="button" aria-pressed={full} onClick={toggleFull}>{full ? "Exit full screen" : "Full screen"}</button>
      </div>
      <div className="ar-body">
        {children}
        <div className="ar-rotate" role="status"><div><div style={{ fontSize: "3em" }}>📱↻</div><p><strong>Turn your phone sideways to play.</strong></p><p style={{ opacity: 0.8, fontSize: ".9em" }}>If rotation is locked, use “Flip screen” above.</p></div></div>
      </div>
    </div>
  );
}
