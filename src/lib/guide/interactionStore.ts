"use client";
import { advance, stepBack, type Spot, type TourState } from "@/lib/guide/interaction";

/**
 * The one place guided interaction is requested from, whichever component
 * asks (the chat window, a button, a link). It remembers an active guide and
 * a pending spot-light for the visit, so they survive moving to another
 * page, and tells the overlay to redraw. The overlay (GuideSpotlight) does
 * the highlighting; this only holds what was asked.
 *
 * What it can be asked to do: start or stop a guide, go forward or back,
 * light up one control (navigating first if needed, by the caller), and
 * clear it.
 */
export interface InteractionState {
  tour: TourState | null;
  spot: Spot | null;
  /** The title of a guide just finished, shown briefly. */
  finished: string | null;
}

const STORE = "loop-interaction-v1";
let state: InteractionState = { tour: null, spot: null, finished: null };
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(STORE);
    const p = raw ? (JSON.parse(raw) as Partial<InteractionState>) : {};
    state = { tour: p.tour ?? null, spot: p.spot ?? null, finished: null };
  } catch {
    /* private mode: guides just do not survive a page change */
  }
}

function set(next: InteractionState) {
  state = next;
  try {
    sessionStorage.setItem(STORE, JSON.stringify({ tour: next.tour, spot: next.spot }));
  } catch {
    /* nothing to remember it in */
  }
  listeners.forEach((l) => l());
}

export function getState(): InteractionState {
  load();
  return state;
}

export const SERVER_STATE: InteractionState = { tour: null, spot: null, finished: null };

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function startTour(id: string, step = 0) {
  load();
  set({ tour: { id, step }, spot: null, finished: null });
}

export function stopTour() {
  load();
  set({ ...state, tour: null, spot: null });
}

export function nextStep(total: number, title: string) {
  load();
  if (!state.tour) return;
  const n = advance(state.tour, total);
  set(n ? { ...state, tour: n } : { tour: null, spot: null, finished: title });
}

export function previousStep() {
  load();
  if (state.tour) set({ ...state, tour: stepBack(state.tour) });
}

export function showSpot(spot: Omit<Spot, "at">) {
  load();
  set({ ...state, spot: { ...spot, at: Date.now() } });
}

export function clearSpot() {
  load();
  if (state.spot) set({ ...state, spot: null });
}

export function clearFinished() {
  load();
  if (state.finished) set({ ...state, finished: null });
}
