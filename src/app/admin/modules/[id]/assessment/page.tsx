"use client";
import { useEffect, useState, useRef } from "react";
import SiteHeader from "@/components/SiteHeader";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import { useToast } from "@/components/ui/Toast";

interface OptionDto {
  id: string;
  text: string;
  key: string;
  isCorrect: boolean;
}
interface QuestionDto {
  id: string;
  text: string;
  topic: string | null;
  difficulty: string | null;
  needsReview: boolean;
  reviewReason: string | null;
  options: OptionDto[];
}
interface ExamDto {
  id: string;
  title: string;
  code: string;
  published: boolean;
  instructions: string | null;
  durationMinutes: number;
  passMarkPercent: number;
  numQuestions: number | null;
  maxAttempts: number | null;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showResultImmediately: boolean;
  showCorrectAnswers: boolean;
  allowReview: boolean;
  questions: QuestionDto[];
  moduleTitle: string;
  courseId: string;
}

const DEFAULT_SETTINGS = {
  title: "",
  instructions:
    "Read each question carefully. Select only one answer. Once the time expires, the assessment will be submitted automatically.",
  durationMinutes: 60,
  passMarkPercent: 80,
  numQuestions: "",
  maxAttempts: "",
  randomizeQuestions: true,
  randomizeOptions: true,
  showResultImmediately: true,
  showCorrectAnswers: false,
  allowReview: true,
};

/**
 * The M11 admin page for a module's bank-backed assessment — the
 * module-scoped twin of /admin/exams/[id]/import, with a settings
 * panel folded in (a module-scoped exam is always reached from here,
 * never from a separate "create exam" form the way a standalone
 * exam is, so settings need a home on this same page). Works whether
 * the module already has an assessment or not: uploading a DOCX
 * auto-creates the assessment shell on the server (see the import
 * route), so there's no separate "create it first" step required to
 * get started — you can just upload.
 */
export default function ModuleAssessmentPage({ params }: { params: { id: string } }) {
  const [exam, setExam] = useState<ExamDto | null>(null);
  const [moduleTitle, setModuleTitle] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{
    questionsDetected: number;
    validQuestions: number;
    questionsRequiringReview: number;
    duplicatesFound: number;
    duplicateCheckSkipped: boolean;
  } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const { confirm, modal } = useConfirmModal();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadAssessment() {
    const res = await fetch(`/api/modules/${params.id}/assessment`);
    const data = await res.json();
    if (res.ok) {
      setExam(data);
      setModuleTitle(data.moduleTitle);
      setCourseId(data.courseId);
      setSettings({
        title: data.title,
        instructions: data.instructions ?? "",
        durationMinutes: data.durationMinutes,
        passMarkPercent: data.passMarkPercent,
        numQuestions: data.numQuestions ? String(data.numQuestions) : "",
        maxAttempts: data.maxAttempts ? String(data.maxAttempts) : "",
        randomizeQuestions: data.randomizeQuestions,
        randomizeOptions: data.randomizeOptions,
        showResultImmediately: data.showResultImmediately,
        showCorrectAnswers: data.showCorrectAnswers,
        allowReview: data.allowReview,
      });
    } else {
      setExam(null);
      setModuleTitle(data.moduleTitle ?? null);
      setCourseId(data.courseId ?? null);
    }
    setLoaded(true);
  }

  useEffect(() => {
    loadAssessment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    setImportSummary(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/modules/${params.id}/assessment/import`, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setUploadError(data.error ?? "Import failed.");
      return;
    }
    const data = await res.json();
    setImportSummary(data);
    await loadAssessment();
  }

  async function approveQuestion(qId: string) {
    await fetch(`/api/questions/${qId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true }),
    });
    await loadAssessment();
  }

  async function deleteQuestion(qId: string) {
    const ok = await confirm({
      title: "Delete this question?",
      description: "This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/questions/${qId}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Could not delete the question. Try again.", "error");
      return;
    }
    showToast("Question deleted.", "success");
    await loadAssessment();
  }

  async function saveEdits(qId: string, text: string, options: OptionDto[]) {
    await fetch(`/api/questions/${qId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        approve: true,
        options: options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
      }),
    });
    await loadAssessment();
  }

  async function saveSettings() {
    setSavingSettings(true);
    setSettingsSaved(false);
    const payload = {
      title: settings.title || undefined,
      instructions: settings.instructions || null,
      durationMinutes: settings.durationMinutes,
      passMarkPercent: settings.passMarkPercent,
      numQuestions: settings.numQuestions ? Number(settings.numQuestions) : null,
      maxAttempts: settings.maxAttempts ? Number(settings.maxAttempts) : null,
      randomizeQuestions: settings.randomizeQuestions,
      randomizeOptions: settings.randomizeOptions,
      showResultImmediately: settings.showResultImmediately,
      showCorrectAnswers: settings.showCorrectAnswers,
      allowReview: settings.allowReview,
    };
    const method = exam ? "PUT" : "POST";
    const res = await fetch(`/api/modules/${params.id}/assessment`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingSettings(false);
    if (res.ok) {
      setSettingsSaved(true);
      await loadAssessment();
    }
  }

  async function handlePublish() {
    setPublishError(null);
    const res = await fetch(`/api/modules/${params.id}/assessment/publish`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      setPublishError(data.error);
      return;
    }
    await loadAssessment();
  }

  if (!loaded) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="h-6 w-40 animate-pulse rounded-full bg-brand-gray/60" />
          <div className="mt-3 h-8 w-72 animate-pulse rounded-full bg-brand-gray/60" />
          <div className="mt-8 h-32 animate-pulse rounded-lg bg-brand-gray/40" />
        </main>
      </>
    );
  }

  const outstandingCount = exam?.questions.filter((q) => q.needsReview).length ?? 0;

  return (
    <>
      <SiteHeader />
      {modal}
      <main className="mx-auto max-w-3xl px-6 py-10">
        {courseId && (
          <a href={`/admin/courses/${courseId}`} className="text-sm text-brand-teal hover:underline">
            ← Back to course
          </a>
        )}
        <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">
          {moduleTitle ? `${moduleTitle} — Assessment` : "Module Assessment"}
        </h1>
        {!exam && (
          <p className="mt-1 text-sm text-gray-600">
            This module doesn&apos;t have an assessment yet. Upload a question document below to create one, or configure
            settings first.
          </p>
        )}

        {/* Upload */}
        <div className="mt-6 rounded-lg border border-dashed border-brand-gray bg-brand-mint p-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <p className="text-sm text-gray-700">Upload a Word (.docx) document of multiple-choice questions.</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mt-3 rounded-lg bg-brand-teal px-4 py-2 font-semibold text-white hover:bg-brand-tealDeep disabled:opacity-60"
          >
            {uploading ? "Processing..." : "Choose .docx file"}
          </button>
          {uploadError && <p className="mt-2 text-sm text-brand-rose">{uploadError}</p>}
        </div>

        {importSummary && (
          <div className="mt-4 rounded-lg border border-brand-gray p-4 text-sm">
            <span className="font-semibold text-gray-900">Import Summary — </span>
            Questions detected: {importSummary.questionsDetected} · Valid: {importSummary.validQuestions} ·{" "}
            <span className={importSummary.questionsRequiringReview > 0 ? "font-semibold text-brand-goldText" : ""}>
              Requiring review: {importSummary.questionsRequiringReview}
            </span>
            {importSummary.duplicatesFound > 0 && (
              <span className="font-semibold text-brand-goldText"> · Possible duplicates: {importSummary.duplicatesFound}</span>
            )}
            {importSummary.duplicateCheckSkipped && (
              <p className="mt-1 text-xs text-gray-500">
                Duplicate detection was skipped for this import — set VOYAGE_API_KEY to enable it (see
                src/lib/embeddings.ts).
              </p>
            )}
          </div>
        )}

        {/* Settings */}
        <details className="mt-8 rounded-lg border border-brand-gray p-4" open={!exam}>
          <summary className="cursor-pointer font-semibold text-gray-900">Assessment Settings</summary>
          <div className="mt-4 space-y-4">
            <Field label="Title">
              <input
                value={settings.title}
                onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                placeholder={moduleTitle ? `${moduleTitle} — Assessment` : ""}
                className="input"
              />
            </Field>
            <Field label="Instructions">
              <textarea
                value={settings.instructions}
                onChange={(e) => setSettings({ ...settings, instructions: e.target.value })}
                className="input"
                rows={3}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Duration (minutes)">
                <input
                  type="number"
                  min={1}
                  value={settings.durationMinutes}
                  onChange={(e) => setSettings({ ...settings, durationMinutes: Number(e.target.value) })}
                  className="input"
                />
              </Field>
              <Field label="Pass Mark (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.passMarkPercent}
                  onChange={(e) => setSettings({ ...settings, passMarkPercent: Number(e.target.value) })}
                  className="input"
                />
              </Field>
              <Field label="Questions per attempt (blank = all)">
                <input
                  type="number"
                  min={1}
                  value={settings.numQuestions}
                  onChange={(e) => setSettings({ ...settings, numQuestions: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Max attempts (blank = unlimited)">
                <input
                  type="number"
                  min={1}
                  value={settings.maxAttempts}
                  onChange={(e) => setSettings({ ...settings, maxAttempts: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
              {(
                [
                  ["randomizeQuestions", "Randomize question order"],
                  ["randomizeOptions", "Randomize option order"],
                  ["showResultImmediately", "Show result immediately"],
                  ["showCorrectAnswers", "Show correct answers after submit"],
                  ["allowReview", "Allow reviewing before submit"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                    className="h-4 w-4 accent-brand-teal"
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              onClick={saveSettings}
              disabled={savingSettings}
              className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-white hover:bg-brand-tealDeep disabled:opacity-60"
            >
              {savingSettings ? "Saving..." : exam ? "Save Settings" : "Create Assessment"}
            </button>
            {settingsSaved && <span className="ml-3 text-sm text-brand-teal">Saved.</span>}
          </div>
        </details>

        {/* Question list */}
        {exam && (
          <>
            <div className="mt-8 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Questions ({exam.questions.length})</h2>
            </div>
            {/* M13 audit finding: topic labels used to be purely
                internal (bank organization only, never shown to a
                trainee). They're now surfaced by name in a trainee's
                AI performance summary after they submit — worth a
                visible note here, not just a hover tooltip on each
                badge, since existing topic labels set before M13
                existed were never written with that audience in mind. */}
            {exam.questions.some((q) => q.topic) && (
              <p className="mt-1 text-xs text-gray-500">
                Topic labels (the small gray tags below) are now shown to trainees by name in their performance
                summary after they submit — worth a glance for tone/clarity if they were set before this mattered.
              </p>
            )}
            <div className="mt-4 space-y-4">
              {exam.questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  onApprove={() => approveQuestion(q.id)}
                  onDelete={() => deleteQuestion(q.id)}
                  onSave={(text, options) => saveEdits(q.id, text, options)}
                />
              ))}
              {exam.questions.length === 0 && (
                <p className="text-sm text-gray-500">No questions in this bank yet — upload a document above.</p>
              )}
            </div>

            {/* Publish */}
            <div className="mt-8 rounded-lg border border-brand-gray p-5">
              {exam.published ? (
                <p className="font-semibold text-brand-teal">
                  This assessment is published — trainees can take it from inside the course.
                </p>
              ) : (
                <div>
                  <p className="text-sm text-gray-600">
                    {outstandingCount > 0
                      ? `${outstandingCount} question(s) still need review before you can publish.`
                      : "All questions look good. Ready to publish."}
                  </p>
                  {publishError && <p className="mt-2 text-sm text-brand-rose">{publishError}</p>}
                  <button
                    onClick={handlePublish}
                    disabled={outstandingCount > 0 || exam.questions.length === 0}
                    className="mt-3 rounded-lg bg-brand-teal px-5 py-2.5 font-semibold text-white hover:bg-brand-tealDeep disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Publish Assessment
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function QuestionCard({
  question,
  onApprove,
  onDelete,
  onSave,
}: {
  question: QuestionDto;
  onApprove: () => void;
  onDelete: () => void;
  onSave: (text: string, options: OptionDto[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.text);
  const [options, setOptions] = useState(question.options);

  return (
    <div
      className={`rounded-lg border p-4 ${
        question.needsReview ? "border-brand-gold bg-brand-goldLight/40" : "border-brand-gray"
      }`}
    >
      {question.needsReview && (
        <p className="mb-2 text-xs font-semibold text-brand-goldText">
          ⚠ {question.reviewReason ?? "Needs review — correct answer could not be confidently identified."}
        </p>
      )}

      {editing ? (
        <div className="space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded border border-brand-gray p-2" rows={2} />
          {options.map((o, idx) => (
            <div key={o.id ?? idx} className="flex items-center gap-2">
              <input
                type="radio"
                checked={o.isCorrect}
                onChange={() => setOptions(options.map((x, i) => ({ ...x, isCorrect: i === idx })))}
                className="accent-brand-teal"
              />
              <input
                value={o.text}
                onChange={(e) => setOptions(options.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)))}
                className="flex-1 rounded border border-brand-gray p-1.5 text-sm"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                onSave(text, options);
                setEditing(false);
              }}
              className="rounded-lg bg-brand-teal px-3 py-1.5 text-sm font-semibold text-white"
            >
              Save
            </button>
            <button onClick={() => setEditing(false)} className="rounded border border-brand-gray px-3 py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="font-medium text-gray-900">{question.text}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {question.options.map((o) => (
              <li key={o.id} className={o.isCorrect ? "font-semibold text-brand-teal" : "text-gray-600"}>
                {o.key}) {o.text} {o.isCorrect && "✓"}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            {question.topic && (
              <span
                className="rounded bg-gray-100 px-2 py-0.5"
                title="Shown to trainees by name in their AI performance summary after they submit an attempt (M13) — not just an internal organizing label anymore."
              >
                {question.topic}
              </span>
            )}
            {question.difficulty && <span className="rounded bg-gray-100 px-2 py-0.5">{question.difficulty}</span>}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => setEditing(true)} className="rounded border border-brand-gray px-3 py-1.5 text-xs font-semibold hover:border-brand-teal">
              Edit
            </button>
            {question.needsReview && (
              <button onClick={onApprove} className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white">
                Approve as-is
              </button>
            )}
            <button onClick={onDelete} className="rounded border border-brand-roseLight px-3 py-1.5 text-xs font-semibold text-brand-rose hover:bg-brand-roseLight/40">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
