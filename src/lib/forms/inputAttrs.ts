import type { InputHTMLAttributes } from "react";

/**
 * Keyboard and typing helpers a phone needs, derived from the field's type so
 * no form has to remember them: an email field gets the email keyboard and no
 * auto-capitalising or auto-correcting, a phone field the dial pad, a link
 * field the URL keyboard. Anything a form sets itself wins over these.
 * Deliberately no autoComplete default: an email box on an admin screen may be
 * for someone else's address, and the browser must not fill in the user's own.
 */
export function inputAttrsForType(type: string | undefined): Partial<InputHTMLAttributes<HTMLInputElement>> {
  switch (type) {
    case "email":
      return { inputMode: "email", autoCapitalize: "none", autoCorrect: "off", spellCheck: false };
    case "tel":
      return { inputMode: "tel" };
    case "url":
      return { inputMode: "url", autoCapitalize: "none", autoCorrect: "off", spellCheck: false };
    case "search":
      return { inputMode: "search", enterKeyHint: "search" };
    case "password":
      return { autoCapitalize: "none", autoCorrect: "off", spellCheck: false };
    default:
      return {};
  }
}

/** The step a button should move to, kept in range. */
export function nextStep(current: number, total: number): number {
  return Math.min(Math.max(current + 1, 0), Math.max(total - 1, 0));
}
export function previousStep(current: number): number {
  return Math.max(current - 1, 0);
}
export function stepProgress(current: number, total: number): { number: number; total: number; isFirst: boolean; isLast: boolean } {
  const t = Math.max(total, 1);
  const c = Math.min(Math.max(current, 0), t - 1);
  return { number: c + 1, total: t, isFirst: c === 0, isLast: c === t - 1 };
}
