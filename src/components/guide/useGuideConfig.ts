"use client";
import { useEffect, useState } from "react";
import { isHiddenPath, type MeKind } from "@/lib/guide/context";
import type { GuideEntry, GuideSwitches } from "@/lib/guide/types";

export interface GuideClientConfig {
  enabled: boolean;
  switches: GuideSwitches;
  entries: GuideEntry[];
  skills: string[];
}

type State = { status: "loading" } | { status: "ready"; config: GuideClientConfig } | { status: "failed" };

let pending: Promise<GuideClientConfig | null> | null = null;

/** One request per page load, shared by everything that needs to know whether Loop is on. */
function load(): Promise<GuideClientConfig | null> {
  pending ??= fetch("/api/guide/config")
    .then((r) => (r.ok ? (r.json() as Promise<GuideClientConfig>) : null))
    .catch(() => null);
  return pending;
}

let pendingMe: Promise<MeKind | null> | null = null;

/** Who is signed in, read once and shared. Failure reads as nobody. */
export function loadMe(): Promise<MeKind | null> {
  pendingMe ??= fetch("/api/guide/me", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.kind as MeKind | null) ?? null)
    .catch(() => null);
  return pendingMe;
}

/** Who is signed in, fetched early only where the answer decides whether Loop shows (the staff area). */
export function useMeForPath(pathname: string): MeKind | null {
  const [me, setMe] = useState<MeKind | null>(null);
  const needed = pathname.startsWith("/admin");
  useEffect(() => {
    if (!needed) return;
    let live = true;
    loadMe().then((k) => live && setMe(k));
    return () => {
      live = false;
    };
  }, [needed]);
  return me;
}

export function useGuideConfig(): State {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let live = true;
    load().then((config) => {
      if (live) setState(config ? { status: "ready", config } : { status: "failed" });
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/**
 * Whether Loop is showing on this page. "loading" until the switch has been
 * read, so the plain page-help button (which Loop replaces) neither flashes
 * nor doubles up.
 */
export function useLoopVisible(pathname: string): "loading" | "visible" | "hidden" {
  const state = useGuideConfig();
  const me = useMeForPath(pathname);
  if (state.status === "loading") return "loading";
  if (state.status === "failed" || !state.config.enabled) return "hidden";
  return isHiddenPath(pathname, me) ? "hidden" : "visible";
}
