"use client";
import { useEffect, useState } from "react";
import { isHiddenPath } from "@/lib/guide/context";
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
  if (state.status === "loading") return "loading";
  if (state.status === "failed" || !state.config.enabled) return "hidden";
  return isHiddenPath(pathname) ? "hidden" : "visible";
}
