"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type LanguageCode } from "@/lib/i18n";
import { SkeletonList } from "@/components/ui/Skeleton";

interface TranslationRow {
  id: string;
  sourceText: string;
  language: string;
  translatedText: string;
  source: "GOOGLE_TRANSLATE" | "AI_DRAFTED";
  approved: boolean;
  approvedBy: { name: string } | null;
}

const TARGET_LANGUAGES = SUPPORTED_LANGUAGES.filter((l): l is Exclude<LanguageCode, "en"> => l !== "en");

/**
 * M42 — the review screen every translation, regardless of which
 * mechanism drafted it, has to pass through before t() will ever
 * return it to a trainee. See UiStringTranslation's own schema
 * comment for why both sources get the exact same gate.
 */
export default function TranslationsAdminPage() {
  const [translations, setTranslations] = useState<TranslationRow[] | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  async function load() {
    const res = await fetch("/api/admin/translations");
    if (res.ok) setTranslations(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function draft(language: string) {
    setDrafting(language);
    const res = await fetch("/api/admin/translations/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language }),
    });
    setDrafting(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not draft translations.", "error");
      return;
    }
    showToast(`${LANGUAGE_LABELS[language as LanguageCode]} drafts ready for review.`);
    await load();
  }

  async function approve(row: TranslationRow) {
    const text = edits[row.id] ?? row.translatedText;
    const res = await fetch(`/api/admin/translations/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ translatedText: text }),
    });
    if (!res.ok) {
      showToast("Could not approve. Try again.", "error");
      return;
    }
    showToast("Approved.");
    await load();
  }

  async function reject(row: TranslationRow) {
    const res = await fetch(`/api/admin/translations/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Could not reject. Try again.", "error");
      return;
    }
    showToast("Rejected — the draft has been removed.");
    await load();
  }

  const byLanguage = new Map<string, TranslationRow[]>();
  for (const row of translations ?? []) {
    if (!byLanguage.has(row.language)) byLanguage.set(row.language, []);
    byLanguage.get(row.language)!.push(row);
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">🌍 Translations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Nothing here reaches a trainee until it&apos;s approved below — machine-drafted, whether from Google
          Translate or AI, is always a starting point, never the final word.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {TARGET_LANGUAGES.map((lang) => (
            <Button key={lang} variant="secondary" loading={drafting === lang} onClick={() => draft(lang)}>
              Draft {LANGUAGE_LABELS[lang]}
            </Button>
          ))}
        </div>

        {translations === null ? (
          <SkeletonList />
        ) : translations.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500">
            No drafts yet — click one of the buttons above to generate some.
          </p>
        ) : (
          Array.from(byLanguage.entries()).map(([lang, rows]) => (
            <section key={lang} className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {LANGUAGE_LABELS[lang as LanguageCode] ?? lang}
              </h2>
              <div className="mt-3 space-y-3">
                {rows.map((row) => (
                  <Card key={row.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">{row.sourceText}</p>
                        <input
                          value={edits[row.id] ?? row.translatedText}
                          onChange={(e) => setEdits({ ...edits, [row.id]: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
                        />
                      </div>
                      <Badge variant={row.approved ? "success" : "warning"}>
                        {row.approved ? "Approved" : "Needs review"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      {row.source === "GOOGLE_TRANSLATE" ? "Google Translate" : "AI-drafted"}
                      {row.approvedBy && ` · approved by ${row.approvedBy.name}`}
                    </p>
                    {!row.approved && (
                      <div className="mt-3 flex gap-2">
                        <Button onClick={() => approve(row)}>Approve</Button>
                        <button
                          onClick={() => reject(row)}
                          className="rounded-lg border border-brand-gray px-3 py-1.5 text-sm font-semibold text-brand-rose"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </>
  );
}
