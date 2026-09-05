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
  questions: QuestionDto[];
}

export default function ImportReviewPage({ params }: { params: { id: string } }) {
  const [exam, setExam] = useState<ExamDto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{ questionsDetected: number; validQuestions: number; questionsRequiringReview: number } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, modal } = useConfirmModal();
  const { showToast } = useToast();

  async function loadExam() {
    const res = await fetch(`/api/exams/${params.id}`);
    if (res.ok) setExam(await res.json());
  }

  useEffect(() => {
    loadExam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    setImportSummary(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/exams/${params.id}/import`, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setUploadError(data.error ?? "Import failed.");
      return;
    }
    const data = await res.json();
    setImportSummary(data);
    await loadExam();
  }

  async function approveQuestion(qId: string) {
    await fetch(`/api/questions/${qId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true }),
    });
    await loadExam();
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
    await loadExam();
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
    await loadExam();
  }

  async function handlePublish() {
    setPublishError(null);
    const res = await fetch(`/api/exams/${params.id}/publish`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      setPublishError(data.error);
      return;
    }
    await loadExam();
  }

  if (!exam) {
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

  const outstandingCount = exam.questions.filter((q) => q.needsReview).length;
  const examUrl = typeof window !== "undefined" ? `${window.location.origin}/exam/${exam.code}` : "";

  return (
    <>
      <SiteHeader />
      {modal}
      <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900">{exam.title}</h1>
      <p className="text-sm text-gray-500">
        Exam code: <span className="font-mono">{exam.code}</span>
      </p>

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
        </div>
      )}

      {/* Question list */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Questions ({exam.questions.length})</h2>
          <a href={`/admin/exams/${exam.id}/results`} className="text-sm text-brand-teal hover:underline">
            View results →
          </a>
        </div>

        {exam.questions.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            onApprove={() => approveQuestion(q.id)}
            onDelete={() => deleteQuestion(q.id)}
            onSave={(text, options) => saveEdits(q.id, text, options)}
          />
        ))}
      </div>

      {/* Publish */}
      <div className="mt-8 rounded-lg border border-brand-gray p-5">
        {exam.published ? (
          <div>
            <p className="font-semibold text-brand-teal">This examination is published.</p>
            <p className="mt-1 text-sm text-gray-600">
              Share this link or code with students:{" "}
              <code className="rounded bg-brand-mint px-1.5 py-0.5">{examUrl}</code>
            </p>
          </div>
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
              Publish Examination
            </button>
          </div>
        )}
      </div>
    </main>
    </>
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
            {question.topic && <span className="rounded bg-gray-100 px-2 py-0.5">{question.topic}</span>}
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
