/**
 * Keeps the app's floating layers from sitting on top of each other.
 * The page can show, at once: a cookie consent banner along the bottom,
 * a round help or messages button at the bottom right, Loop broadcast
 * cards that stay until dismissed, and toasts. Each used to anchor
 * itself to the bottom edge independently, so the banner covered the
 * buttons and the broadcast cards covered both.
 *
 * Now each layer that takes up room reports its height here, and each
 * layer above it offsets itself by the CSS variables this sets on the
 * root element:
 *
 *   --layer-banner  height of the cookie banner (0 when hidden)
 *   --layer-fab     footprint of the page's round bottom-right button
 *                   (page help, or the trainee messages button)
 *   --layer-loop    footprint of Loop, the guide button, which sits
 *                   above that round button when there is one
 *
 * Stacking from the bottom: banner, the page's round button, Loop, then
 * broadcast cards. Toasts clear the banner.
 */
const offsets = new Map<string, number>();

function apply() {
  const root = document.documentElement;
  root.style.setProperty("--layer-banner", `${offsets.get("banner") ?? 0}px`);
  root.style.setProperty("--layer-fab", `${offsets.get("fab") ?? 0}px`);
  root.style.setProperty("--layer-loop", `${offsets.get("loop") ?? 0}px`);
}

export function setFloatingOffset(key: "banner" | "fab" | "loop", px: number) {
  if (px > 0) offsets.set(key, px);
  else offsets.delete(key);
  apply();
}

/** The round bottom-right button: 48px tall plus a 12px gap. */
export const FAB_FOOTPRINT_PX = 60;
/** Loop's button: 56px tall plus a 12px gap. */
export const LOOP_FOOTPRINT_PX = 68;

/** CSS for an element anchored 1.5rem from the bottom, clear of the banner. */
export const ABOVE_BANNER = "calc(1.5rem + var(--layer-banner, 0px))";
/** CSS for an element stacked above the banner and the page's round button (Loop's own place). */
export const ABOVE_BANNER_AND_PAGE_FAB = "calc(1.5rem + var(--layer-banner, 0px) + var(--layer-fab, 0px))";
/** CSS for an element stacked above the banner, the round button and Loop. */
export const ABOVE_BANNER_AND_FAB = "calc(1.5rem + var(--layer-banner, 0px) + var(--layer-fab, 0px) + var(--layer-loop, 0px))";
