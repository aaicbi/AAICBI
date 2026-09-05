/**
 * M42 (technical piece) — the actual lookup mechanism behind
 * Trainee.preferredLanguage, now backed by real `UiStringTranslation`
 * rows instead of a permanently-empty hardcoded dictionary. See that
 * model's own schema comment for the two drafting mechanisms
 * (Google Translate for Yoruba/Igbo/Hausa/French, Claude for Nigerian
 * Pidgin specifically, since Google's API doesn't support it) and the
 * review discipline both go through before anything here is trusted.
 *
 * `t()` itself stays a plain, synchronous function — it looks up a
 * string in a map the caller already fetched, it never touches the
 * database itself. This keeps every existing call site's shape
 * unchanged; only what gets passed in as `translations` needs to
 * come from somewhere real now. Always falls back to the English text
 * whenever no approved translation exists for a key — safe to call
 * everywhere regardless of whether a language's translations are
 * complete yet.
 */

export const SUPPORTED_LANGUAGES = ["en", "yo", "ig", "ha", "fr", "pcm"] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: "English",
  yo: "Yoruba",
  ig: "Igbo",
  ha: "Hausa",
  fr: "French",
  pcm: "Pidgin",
};

/**
 * The real, bounded master list this milestone actually scoped —
 * navigation, buttons, common system messages, not lesson content.
 * Both drafting routes translate exactly this list, nothing more —
 * adding a new translatable string anywhere in the app means adding it
 * here first, the same deliberate, explicit approach as every other
 * admin-configurable list in this project.
 */
export const TRANSLATABLE_STRINGS: string[] = [
  "Dashboard",
  "Courses",
  "Settings",
  "Sign in",
  "Sign out",
  "Save",
  "Cancel",
  "Continue",
  "Back",
];

export function t(englishText: string, translations: Record<string, string>): string {
  return translations[englishText] ?? englishText;
}
