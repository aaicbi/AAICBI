/**
 * The rules of guided interaction, with no browser access so they can be
 * tested: how a control is named, which page a step belongs to, what counts
 * as the person having done a step, and how a tour moves.
 *
 * A control opts in by carrying data-guide-target="some-id". Loop never
 * looks controls up by their text or position, so a restyle cannot break a
 * guide; a renamed label cannot either.
 */
export type CompleteOn = "click" | "input" | "submit" | "none";

export const TARGET_ID = /^[A-Za-z0-9:_\-/.]{1,80}$/;

/** A selector for one guide target. The id is escaped, so any id that passes TARGET_ID is safe in a selector. */
export function targetSelector(id: string): string {
  return `[data-guide-target="${id.replace(/["\\]/g, "\\$&")}"]`;
}

const pathOf = (href: string) => href.split("#")[0].split("?")[0] || "/";

/** Whether the person is on the page a step's control lives on. A step with no page happens wherever the control is. */
export function onStepPage(page: string | undefined, pathname: string): boolean {
  if (!page) return true;
  const p = pathOf(page);
  const here = pathOf(pathname);
  return here === p || (p !== "/" && here.startsWith(p + "/"));
}

export type DomEvent = "click" | "input" | "change" | "submit";

/** Whether an event on the highlighted control counts as doing the step. */
export function completes(event: DomEvent, completeOn: CompleteOn): boolean {
  switch (completeOn) {
    case "click": return event === "click";
    case "input": return event === "change" || event === "input";
    case "submit": return event === "submit" || event === "click";
    default: return false;
  }
}

export interface TourState {
  id: string;
  step: number;
}

/** The next step, or null when the guide is finished. */
export function advance(state: TourState, total: number): TourState | null {
  return state.step + 1 >= total ? null : { ...state, step: state.step + 1 };
}

export function stepBack(state: TourState): TourState {
  return { ...state, step: Math.max(0, state.step - 1) };
}

/** A spot-light request: light up one control, then let it go. */
export interface Spot {
  target: string;
  /** Short words shown beside it ("Your messages are here"). */
  text?: string;
  completeOn?: CompleteOn;
  /** When this request was made; it is dropped if the control is not found within a minute. */
  at: number;
}

export const SPOT_WAIT_MS = 60_000;
export const SPOT_SHOWN_MS = 25_000;

export function spotExpired(spot: Spot, now: number, found: boolean): boolean {
  return now - spot.at > (found ? SPOT_SHOWN_MS : SPOT_WAIT_MS);
}

export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Whether two boxes come within `margin` pixels of each other. */
export function nearlyTouch(a: Rect, b: Rect, margin = 12): boolean {
  return a.left < b.right + margin && a.right > b.left - margin && a.top < b.bottom + margin && a.bottom > b.top - margin;
}

/**
 * Where the small card that explains the step goes so it never covers or
 * crowds the control being pointed at: at the bottom by default; the other
 * side when the card, where it actually is, would touch the control.
 */
export function cardPlacement(current: "bottom" | "top", card: Rect | null, target: Rect | null): "bottom" | "top" {
  if (!card || !target) return current;
  return nearlyTouch(card, target) ? (current === "bottom" ? "top" : "bottom") : current;
}
