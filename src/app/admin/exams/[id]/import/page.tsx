"use client";
import { useEffect, useState, useRef } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Icon from "@/components/ui/Icon";
import CorrectnessMark from "@/components/ui/CorrectnessMark";
import Toggle from "@/components/ui/Toggle";
import { ADMIN_NAV } from "@/lib/admin/nav";

import { Checkbox, Input, Textarea } from "@/components/ui/Field";
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
  certificateEnabled: boolean;
  courseId: string | null;
  moduleId: string | null;
  questions: QuestionDto[];
}
interface AccessGrantDto {
  id: string;
  trainee: { id: string; name: string; email: string };
  grantedBy: { name: string };
  grantedAt: string;
  revokedAt: string | null;
}

export default function ImportReviewPage({ params }: { params: { id: string } }) {
  const [exam, setExam] = useState<ExamDto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{ questionsDetected: number; validQuestions: number; questionsRequiringReview: number } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, modal } = useConfirmModal();
  const { showToast } = useToast();

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [accessGrants, setAccessGrants] = useState<AccessGrantDto[] | null>(null);
  const [grantEmail, setGrantEmail] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [togglingCertificate, setTogglingCertificate] = useState(false);

  async function loadExam() {
    const res = await fetch(`/api/exams/${params.id}`);
    if (res.ok) setExam(await res.json());
  }

  useEffect(() => {
    loadExam();
    // Same isSuperAdmin check PerformanceDashboard already uses — the
    // access-grant section below is Super-Admin-only, both here
    // (client-side, for a clean view) and server-side (the real
    // boundary, in /api/exams/[id]/access).
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIsSuperAdmin(data?.role === "SUPER_ADMIN"))
      .catch(() => setIsSuperAdmin(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const isStandalone = !!exam && !exam.courseId && !exam.moduleId;

  useEffect(() => {
    if (!isStandalone || !isSuperAdmin) return;
    fetch(`/api/exams/${params.id}/access`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setAccessGrants)
      .catch(() => setAccessGrants([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStandalone, isSuperAdmin, params.id]);

  async function grantAccess(e: React.FormEvent) {
    e.preventDefault();
    setGranting(true);
    setGrantError(null);
    const res = await fetch(`/api/exams/${params.id}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: grantEmail }),
    });
    setGranting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setGrantError(typeof data.error === "string" ? data.error : "Could not grant access. Check the email and try again.");
      return;
    }
    setGrantEmail("");
    showToast("Access granted — the trainee has been emailed.", "success");
    const refreshed = await fetch(`/api/exams/${params.id}/access`);
    if (refreshed.ok) setAccessGrants(await refreshed.json());
  }

  async function revokeAccess(grantId: string) {
    setRevokingId(grantId);
    await fetch(`/api/exams/${params.id}/access/${grantId}`, { method: "PATCH" });
    setRevokingId(null);
    const refreshed = await fetch(`/api/exams/${params.id}/access`);
    if (refreshed.ok) setAccessGrants(await refreshed.json());
  }

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

  function toggleSelect(qId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(qId) ? next.delete(qId) : next.add(qId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!exam) return;
    setSelected((prev) => (prev.size === exam.questions.length ? new Set() : new Set(exam.questions.map((q) => q.id))));
  }

  async function bulkDeleteQuestions() {
    if (!exam || selected.size === 0) return;
    const ok = await confirm({
      title: `Delete ${selected.size} question${selected.size === 1 ? "" : "s"}?`,
      description: "This can't be undone. Any selected question that already has a trainee answer recorded will be skipped, not deleted.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBulkDeleting(true);
    const res = await fetch(`/api/exams/${exam.id}/questions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIds: Array.from(selected) }),
    });
    setBulkDeleting(false);
    if (!res.ok) {
      showToast("Could not delete the selected questions. Try again.", "error");
      return;
    }
    const data = await res.json();
    const skippedNote = data.skipped.length > 0 ? ` ${data.skipped.length} skipped (already has trainee answers recorded).` : "";
    showToast(`Deleted ${data.deleted} question(s).${skippedNote}`, data.deleted > 0 ? "success" : "error");
    setSelected(new Set());
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

  async function toggleCertificate(enabled: boolean) {
    setTogglingCertificate(true);
    await fetch(`/api/exams/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ certificateEnabled: enabled }),
    });
    setTogglingCertificate(false);
    showToast(enabled ? "Certificates enabled — anyone who already passed just got theirs." : "Certificates disabled for new passes.", "success");
    await loadExam();
  }

  if (!exam) {
    return (
      <>
        <SiteHeader
          nav={ADMIN_NAV}
          right={<LogoutButton />}
        />
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
      <SiteHeader
        nav={ADMIN_NAV}
        right={<LogoutButton />}
      />
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
          className="mt-3 rounded-lg bg-brand-teal px-4 py-2 font-semibold text-brand-onAccent hover:bg-brand-tealDeep disabled:opacity-60"
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
          <div className="flex items-center gap-4">
            {exam.questions.length > 0 && (
              <Checkbox label="Select all" checked={selected.size === exam.questions.length} onChange={toggleSelectAll} />
            )}
            <a href={`/admin/exams/${exam.id}/results`} className="inline-flex items-center gap-1 text-sm text-brand-teal hover:underline">
              View results <Icon icon={ArrowRight} size="sm" />
            </a>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-brand-rose bg-brand-roseLight/30 p-3 text-sm">
            <span>{selected.size} selected</span>
            <button
              onClick={bulkDeleteQuestions}
              disabled={bulkDeleting}
              className="rounded-lg bg-brand-rose px-3 py-1.5 text-xs font-semibold text-brand-onAccent disabled:opacity-60"
            >
              {bulkDeleting ? "Deleting..." : "Delete selected"}
            </button>
          </div>
        )}

        {exam.questions.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            selected={selected.has(q.id)}
            onToggleSelect={() => toggleSelect(q.id)}
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
              {isStandalone
                ? "Only trainees granted access below can see or start it — the code alone isn't enough:"
                : "Share this link or code with students:"}{" "}
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
              className="mt-3 rounded-lg bg-brand-teal px-5 py-2.5 font-semibold text-brand-onAccent hover:bg-brand-tealDeep disabled:cursor-not-allowed disabled:opacity-40"
            >
              Publish Examination
            </button>
          </div>
        )}
      </div>

      {/* Certificate — standalone exams only (see ExamCertificate's own
          comment): a course examination already has its own
          certificate path tied to course completion, unrelated to this
          toggle. */}
      {isStandalone && (
        <div className="mt-8 rounded-lg border border-brand-gray p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Certificate</h2>
              <p className="mt-1 text-sm text-gray-500">
                {exam.certificateEnabled
                  ? "A trainee who passes this exam automatically earns a verifiable certificate."
                  : "Turn this on to automatically issue a certificate to anyone who passes."}
              </p>
            </div>
            <Toggle checked={exam.certificateEnabled} onChange={toggleCertificate} disabled={togglingCertificate} label="Issue certificate on pass" />
          </div>
        </div>
      )}

      {/* Access control — standalone exams only (see ExamAccessGrant's
          own comment): not tied to a course, so nothing else gates who
          can even see this exam. Super Admin only, both here and
          server-side. */}
      {isStandalone && isSuperAdmin && (
        <div className="mt-8 rounded-lg border border-brand-gray p-5">
          <h2 className="font-semibold text-gray-900">Access</h2>
          <p className="mt-1 text-sm text-gray-500">
            Only trainees you grant access to below can see or start this examination — useful for a knowledge test aimed at a
            specific group (e.g. screening applicants for a role) rather than every trainee on the platform.
          </p>

          <form onSubmit={grantAccess} className="mt-4 flex gap-2">
            <Input label="Trainee's registered email" hideLabel compact wrapperClassName="flex-1" type="email" required value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} placeholder="Trainee's registered email" />
            <button
              type="submit"
              disabled={granting}
              className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep disabled:opacity-60"
            >
              {granting ? "Granting..." : "Grant Access"}
            </button>
          </form>
          {grantError && <p className="mt-2 text-sm text-brand-rose">{grantError}</p>}

          <div className="mt-4 space-y-2">
            {accessGrants === null && <p className="text-sm text-gray-400">Loading…</p>}
            {accessGrants?.length === 0 && <p className="text-sm text-gray-400">No one has been granted access yet.</p>}
            {accessGrants?.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-lg border border-brand-gray px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold text-gray-900">{g.trainee.name}</p>
                  <p className="text-xs text-gray-500">
                    {g.trainee.email} · granted by {g.grantedBy.name} on {new Date(g.grantedAt).toLocaleDateString()}
                  </p>
                </div>
                {g.revokedAt ? (
                  <span className="text-xs font-semibold text-gray-400">Revoked</span>
                ) : (
                  <button
                    onClick={() => revokeAccess(g.id)}
                    disabled={revokingId === g.id}
                    className="text-xs font-semibold text-brand-rose hover:underline disabled:opacity-60"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
    </>
  );
}

function QuestionCard({
  question,
  selected,
  onToggleSelect,
  onApprove,
  onDelete,
  onSave,
}: {
  question: QuestionDto;
  selected: boolean;
  onToggleSelect: () => void;
  onApprove: () => void;
  onDelete: () => void;
  onSave: (text: string, options: OptionDto[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.text);
  const [options, setOptions] = useState(question.options);

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 ${
        question.needsReview ? "border-brand-gold bg-brand-goldLight/40" : "border-brand-gray"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        className="mt-1.5 h-4 w-4 accent-brand-teal"
        aria-label="Select this question"
      />
      <div className="flex-1">
      {question.needsReview && (
        <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-brand-goldText">
          <Icon icon={AlertTriangle} size="sm" /> {question.reviewReason ?? "Needs review — correct answer could not be confidently identified."}
        </p>
      )}

      {editing ? (
        <div className="space-y-2">
          <Textarea label="Question text" hideLabel compact controlClassName="p-2" value={text} onChange={(e) => setText(e.target.value)} rows={2} />
          {options.map((o, idx) => (
            <div key={o.id ?? idx} className="flex items-center gap-2">
              <input
                type="radio"
                checked={o.isCorrect}
                onChange={() => setOptions(options.map((x, i) => ({ ...x, isCorrect: i === idx })))}
                className="accent-brand-teal"
              />
              <Input label="Option text" hideLabel compact wrapperClassName="flex-1" controlClassName="p-1.5" value={o.text} onChange={(e) => setOptions(options.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)))} />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                onSave(text, options);
                setEditing(false);
              }}
              className="rounded-lg bg-brand-teal px-3 py-1.5 text-sm font-semibold text-brand-onAccent"
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
              <li key={o.id} className={o.isCorrect ? "flex items-center gap-1 font-semibold text-brand-teal" : "text-gray-600"}>
                {o.key}) {o.text} {o.isCorrect && <CorrectnessMark state="correct" label="Correct answer" />}
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
              <button onClick={onApprove} className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-brand-onAccent">
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
    </div>
  );
}
