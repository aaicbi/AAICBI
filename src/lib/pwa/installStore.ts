"use client";
import { useEffect, useState } from "react";
import { isIosDevice } from "@/lib/pwa/installCore";

/**
 * One shared place for the browser's install offer, so the install card and
 * the "Install the app" item in the menus agree. The browser hands over its
 * install prompt once (beforeinstallprompt); it is kept here until used.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
let started = false;

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  installed = isStandalone();
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const e = deferred;
  deferred = null;
  notify();
  await e.prompt();
  const choice = await e.userChoice.catch(() => ({ outcome: "dismissed" as const }));
  return choice.outcome;
}

export function useInstallState() {
  const [, tick] = useState(0);
  // Browser facts are read after mount, never during render: the server cannot
  // know them, and rendering them on the first client pass would not match the
  // server's HTML (React then rebuilds the whole page and drops the theme class).
  const [ios, setIos] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setIos(isIosDevice(navigator.userAgent, navigator.maxTouchPoints));
    setReady(true);
    start();
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);
  // Until mounted, report "installed" so nothing install-related renders on the server or the first client pass.
  return { installed: !ready || installed, canPrompt: ready && !!deferred, ios };
}
