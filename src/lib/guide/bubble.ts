/**
 * When Loop may speak up unprompted. Kept deliberately rare: a couple of
 * short hints per visit, never twice on the same kind of page, never again
 * once someone has asked for quiet, and never while the chat is open or
 * the visitor is typing somewhere. This file decides; the component only
 * stores the state and shows the result.
 */
export const BUBBLE_DELAY_MS = 7000;
export const BUBBLE_VISIBLE_MS = 10000;
export const MAX_HINTS_PER_VISIT = 2;

export interface BubbleState {
  shownCount: number;
  shownKeys: string[];
  /** The visitor asked for no more hints. Kept between visits. */
  quiet: boolean;
}

export const FRESH_BUBBLE_STATE: BubbleState = { shownCount: 0, shownKeys: [], quiet: false };

export function nextHint(page: { key: string; bubbles: string[] }, state: BubbleState): string | null {
  if (state.quiet) return null;
  if (state.shownCount >= MAX_HINTS_PER_VISIT) return null;
  if (state.shownKeys.includes(page.key)) return null;
  if (page.bubbles.length === 0) return null;
  return page.bubbles[state.shownCount % page.bubbles.length];
}

export function afterShown(state: BubbleState, pageKey: string): BubbleState {
  return { ...state, shownCount: state.shownCount + 1, shownKeys: [...state.shownKeys, pageKey] };
}
