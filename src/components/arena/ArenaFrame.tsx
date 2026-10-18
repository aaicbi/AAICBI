"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import "./arena.css";
import { wake } from "./sound";

/**
 * The full-screen frame shared by the lobby and the match. Phones play upright (portrait, one hand, the way Kahoot, Trivia Crack and
 * Duolingo do it); tablets and desktops get the wide three-column board. No rotating or flipping is ever asked of the player.
 */
export default function ArenaFrame({ title, backHref, sound, onSound, onExit, children }: {
  title: string; backHref: string; sound?: boolean; onSound?: (on: boolean) => void;
  /** Called before leaving to another page (the match pauses itself first). Without it, links simply navigate. */
  onExit?: (href: string) => void; children: ReactNode;
}) {
  const go = (href: string) => (e: React.MouseEvent) => { if (onExit) { e.preventDefault(); onExit(href); } };
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
    } catch { /* not supported */ }
  };
  return (
    <div className="ar-root" onPointerDown={wake}>
      <div className="ar-bar">
        <Link href={backHref} aria-label="Back" onClick={go(backHref)}>←<span className="ar-btxt"> Back</span></Link>
        <h1>{title}</h1>
        <Link href="/feed" aria-label="Leave the game screen and use the app" onClick={go("/feed")}>🏠<span className="ar-btxt"> App</span></Link>
        {onSound && <button type="button" aria-pressed={!!sound} aria-label={sound ? "Sound on" : "Sound off"} onClick={() => onSound(!sound)}>{sound ? "🔊" : "🔇"}<span className="ar-btxt">{sound ? " Sound on" : " Sound off"}</span></button>}
        <button type="button" className="ar-fsbtn" aria-pressed={full} onClick={toggleFull}>{full ? "Exit full screen" : "Full screen"}</button>
      </div>
      <div className="ar-body">{children}</div>
    </div>
  );
}
