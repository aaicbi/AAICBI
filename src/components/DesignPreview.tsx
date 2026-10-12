"use client";
import { useEffect, useState } from "react";

const LEVELS = [{ label: "19%", value: "0.19" }, { label: "30%", value: "0.30" }, { label: "42%", value: "0.42" }] as const;
const FLAG = "design-preview";
const LEVEL = "design-wp";

/**
 * A way to try the light-mode wallpaper at different strengths on the real site, for choosing one. Hidden unless the address has
 * ?preview=design (it then stays on for that browser tab; ?preview=off hides it). It only changes how the page looks in this tab.
 * Delete this component and its line in layout.tsx once a strength is chosen.
 */
export default function DesignPreview() {
  const [on, setOn] = useState(false);
  const [level, setLevel] = useState("0.30");

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("preview");
      if (q === "design") sessionStorage.setItem(FLAG, "1");
      if (q === "off") sessionStorage.removeItem(FLAG);
      setOn(sessionStorage.getItem(FLAG) === "1");
      setLevel(sessionStorage.getItem(LEVEL) ?? "0.30");
    } catch { /* storage may be blocked; the page just looks as published */ }
  }, []);

  useEffect(() => {
    if (!on || document.documentElement.classList.contains("dark")) return;
    let cancelled = false;
    fetch("/wallpaper-pattern.svg").then((r) => r.text()).then((svg) => {
      if (cancelled) return;
      const mod = svg.replace(/opacity="[0-9.]+"/, `opacity="${level}"`);
      document.body.style.backgroundImage = `url("data:image/svg+xml;base64,${btoa(mod)}")`;
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [on, level]);

  if (!on) return null;
  return (
    <div role="group" aria-label="Wallpaper strength preview" className="fixed bottom-20 left-3 z-[44] flex items-center gap-1 rounded-full border border-brand-gray bg-brand-surface p-1 text-xs font-semibold shadow-md print:hidden lg:bottom-3">
      <span className="px-2 text-gray-600">Wallpaper</span>
      {LEVELS.map((l) => (
        <button key={l.value} type="button" aria-pressed={level === l.value} onClick={() => { setLevel(l.value); try { sessionStorage.setItem(LEVEL, l.value); } catch { /* fine */ } }}
          className={`min-h-[32px] rounded-full px-3 ${level === l.value ? "bg-brand-action text-brand-onAccent" : "text-brand-ink hover:bg-brand-mint"}`}>{l.label}</button>
      ))}
    </div>
  );
}
