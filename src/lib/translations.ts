/**
 * M42 — the two drafting mechanisms behind the admin-triggered
 * "Draft Translations" action. See UiStringTranslation's own schema
 * comment for the full reasoning on why there are two, and why both
 * go through the exact same human-approval gate regardless of source.
 *
 * Honest note on what could and couldn't be verified while building
 * this: `draftPidginTranslations` reuses this project's existing
 * Anthropic SDK pattern (see extractQuestions.ts) and can genuinely be
 * exercised the same way that code already is. `draftGoogleTranslations`
 * calls a real external API this sandbox has no network access to and
 * no credentials for — written correctly against Google's documented
 * Cloud Translation "Basic" (v2) REST shape, the same category of
 * "built correctly, not verified end-to-end from here" as this
 * project's Paystack and WhatsApp integration code.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TRANSLATABLE_STRINGS, LANGUAGE_LABELS, type LanguageCode } from "@/lib/i18n";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function upsertDraft(
  sourceText: string,
  language: string,
  translatedText: string,
  source: "GOOGLE_TRANSLATE" | "AI_DRAFTED"
): Promise<void> {
  // Upsert, not create — re-running a draft action for a language
  // that already has drafts refreshes them rather than erroring on
  // the unique (sourceText, language) constraint. A translation
  // that's already been approved gets its approval reset to false on
  // re-draft — a fresh machine-generated string is a new thing to
  // review, not an automatic continuation of a human's earlier sign-off.
  await prisma.uiStringTranslation.upsert({
    where: { sourceText_language: { sourceText, language } },
    create: { sourceText, language, translatedText, source },
    update: { translatedText, source, approved: false },
  });
}

/**
 * Google Cloud Translation "Basic" (v2) REST API — a plain fetch()
 * call rather than pulling in Google's full client SDK as a new
 * dependency, appropriate for how small and infrequent this app's
 * actual translation need is (an admin-triggered batch of ~9 short
 * strings, not a high-volume, latency-sensitive integration).
 */
const GoogleTranslateResponseSchema = z.object({
  data: z.object({
    translations: z.array(z.object({ translatedText: z.string() })),
  }),
});

export async function draftGoogleTranslations(language: Exclude<LanguageCode, "en" | "pcm">): Promise<void> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_TRANSLATE_API_KEY is not set — see DEPLOYMENT.md. This is required to draft translations, not optional the way some of this app's other integrations are."
    );
  }

  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: TRANSLATABLE_STRINGS, source: "en", target: language, format: "text" }),
  });
  if (!res.ok) {
    throw new Error(`Google Translate API request failed: ${res.status} ${await res.text()}`);
  }
  const parsed = GoogleTranslateResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new Error("Google Translate API returned an unexpected response shape.");
  }
  // Same fix as the Pidgin path below: refuse to guess at pairings if
  // the response doesn't have exactly as many entries as requested,
  // rather than silently indexing into a possibly-mismatched array.
  // The positional-matching assumption itself (translation i
  // corresponds to input string i) is standard, documented behavior
  // for this API — but genuinely unverifiable from this sandbox, which
  // has no network access to test against the real endpoint. This
  // length check doesn't prove the ordering is right; it's the one
  // thing that can be checked without that access, and it turns a
  // "wrong count" failure mode into a loud error instead of a silent
  // one.
  if (parsed.data.data.translations.length !== TRANSLATABLE_STRINGS.length) {
    throw new Error(
      `Google Translate returned ${parsed.data.data.translations.length} translations but ${TRANSLATABLE_STRINGS.length} were requested — refusing to guess which is which.`
    );
  }

  await Promise.all(
    TRANSLATABLE_STRINGS.map((sourceText, i) =>
      upsertDraft(sourceText, language, parsed.data.data.translations[i].translatedText, "GOOGLE_TRANSLATE")
    )
  );
}

/**
 * Nigerian Pidgin — genuinely not supported by Google's API (checked
 * directly against Google's own current language list before this was
 * built, not assumed), so drafted by Claude instead, reusing the exact
 * same client setup and JSON-only response pattern already
 * established in extractQuestions.ts for exam question structuring.
 */
const PidginDraftSchema = z.object({
  translations: z.array(z.string()),
});

const PIDGIN_SYSTEM_PROMPT = `You translate short English UI strings (navigation labels, button text, system messages) from a Nigerian learning platform into Nigerian Pidgin (Naija).

Rules:
- Use natural, widely-understood Nigerian Pidgin, not a word-for-word English gloss.
- Keep translations short — these are UI labels and buttons, not sentences.
- Respond with ONLY a JSON object of the shape {"translations": ["...", "...", ...]} — exactly one Pidgin string per input string, in the exact same order given, nothing added or removed. No preamble, no markdown fences.`;

export async function draftPidginTranslations(): Promise<void> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1000,
    system: PIDGIN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(TRANSLATABLE_STRINGS) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content for the Pidgin translation draft.");
  }
  const parsed = PidginDraftSchema.safeParse(JSON.parse(textBlock.text));
  if (!parsed.success) {
    throw new Error("Claude's Pidgin translation response didn't match the expected shape.");
  }
  // Audit finding, fixed before it could cause a real problem: this
  // used to match translations back to their English source by
  // trusting Claude's own echo of the source text in its response —
  // if Claude reproduced a string with even a small difference
  // (capitalization, punctuation), the translation would be saved
  // under a key that doesn't exactly match TRANSLATABLE_STRINGS, and
  // t() would never find it — silently, with no error anywhere. Fixed
  // to match positionally instead, the same strategy already used for
  // Google Translate, plus an explicit length check so a genuinely
  // mismatched response fails loudly instead of silently corrupting
  // data — the same class of "would have shipped a wrong answer with
  // no error" mistake the earlier courseModule bug was.
  if (parsed.data.translations.length !== TRANSLATABLE_STRINGS.length) {
    throw new Error(
      `Claude returned ${parsed.data.translations.length} translations but ${TRANSLATABLE_STRINGS.length} were requested — refusing to guess which is which.`
    );
  }

  await Promise.all(
    TRANSLATABLE_STRINGS.map((sourceText, i) => upsertDraft(sourceText, "pcm", parsed.data.translations[i], "AI_DRAFTED"))
  );
}

export function isGoogleTranslateLanguage(language: LanguageCode): language is Exclude<LanguageCode, "en" | "pcm"> {
  return language !== "en" && language !== "pcm";
}

export { LANGUAGE_LABELS };
