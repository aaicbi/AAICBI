"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import { AlertTriangle, Users, ChevronDown, ChevronRight, BarChart3 } from "lucide-react";

import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
const QUESTION_TYPES = [
  "SHORT_ANSWER", "EXPLANATION", "LONG_ANSWER", "ESSAY", "SCENARIO",
  "CASE_STUDY", "PRACTICAL_TASK", "TECHNICAL_RESPONSE", "REFLECTION", "MULTI_PART",
] as const;
type QuestionType = (typeof QUESTION_TYPES)[number];

interface RubricCriterion {
  name: string;
  maxMarks: number;
  description: string | null;
}

interface QuestionDto {
  id: string;
  section: string | null;
  questionNumber: string;
  type: QuestionType;
  questionText: string;
  instructions: string | null;
  expectedAnswer: string | null;
  expectedConcepts: string[] | null;
  rubric: RubricCriterion[] | null;
  maxMarks: number;
  order: number;
  needsReview: boolean;
  reviewReason: string | null;
}

interface AssignmentDto {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
  dueAt: string | null;
  lateSubmissionPolicy: "ALLOWED" | "ALLOWED_WITH_FLAG" | "NOT_ALLOWED";
  allowEditAfterSubmission: boolean;
  aiAssessmentEnabled: boolean;
  resubmissionPolicy: "NONE" | "ONE" | "LIMITED" | "UNLIMITED";
  maxResubmissions: number | null;
  resubmissionScope: "FULL_ASSIGNMENT" | "FAILED_QUESTIONS_ONLY";
  failedQuestionThresholdPercent: number;
  questions: QuestionDto[];
  _count: { submissions: number };
}

interface ValidationIssue {
  questionNumber: string;
  severity: "blocker" | "warning";
  message: string;
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    /* ignore */
  }
  return fallback;
}

export default function AssignmentBuilderPage({ params }: { params: { id: string } }) {
  const [assignment, setAssignment] = useState<AssignmentDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);
  const [publishing, setPublishing] = useState(false);
  const { showToast } = useToast();
  const { confirm, modal } = useConfirmModal();

  async function load() {
    const res = await fetch(`/api/admin/assignments/${params.id}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    setAssignment(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handlePublish() {
    setPublishing(true);
    setIssues(null);
    const res = await fetch(`/api/admin/assignments/${params.id}/publish`, { method: "POST" });
    setPublishing(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setIssues(data.issues ?? null);
      showToast(data.error ?? "Could not publish. Fix the issues below and try again.", "error");
      return;
    }
    setIssues(data.issues ?? []);
    showToast("Assignment published.");
    load();
  }

  async function handleUnpublish() {
    const res = await fetch(`/api/admin/assignments/${params.id}/unpublish`, { method: "POST" });
    if (!res.ok) {
      showToast("Could not unpublish. Try again.", "error");
      return;
    }
    showToast("Assignment unpublished.");
    load();
  }

  async function updateAssignment(data: Partial<AssignmentDto>): Promise<string | null> {
    const res = await fetch(`/api/admin/assignments/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return readApiError(res, "Could not save. Try again.");
    await load();
    return null;
  }

  async function deleteQuestion(questionId: string) {
    const ok = await confirm({ title: "Delete this question?", description: "This can't be undone.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    const res = await fetch(`/api/admin/assignments/${params.id}/questions/${questionId}`, { method: "DELETE" });
    if (!res.ok) {
      showToast(await readApiError(res, "Could not delete the question."), "error");
      return;
    }
    showToast("Question deleted.");
    load();
  }

  if (notFound) return <main className="mx-auto max-w-3xl px-6 py-10 text-center text-gray-600">Assignment not found.</main>;
  if (!assignment) return <main className="mx-auto max-w-3xl px-6 py-10"><SkeletonList /></main>;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {modal}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-brand-ink">{assignment.title}</h1>
          {assignment.description && <p className="mt-1 text-sm text-gray-600">{assignment.description}</p>}
        </div>
        <div className="shrink-0 text-right">
          <Badge variant={assignment.status === "PUBLISHED" ? "success" : "neutral"}>{assignment.status}</Badge>
          <div className="mt-2 flex flex-col gap-2">
            {assignment.status === "PUBLISHED" ? (
              <Button variant="secondary" size="sm" onClick={handleUnpublish}>Unpublish</Button>
            ) : (
              <Button size="sm" onClick={handlePublish} loading={publishing}>Publish</Button>
            )}
            <Link href={`/admin/assignments/${params.id}/submissions`} className="text-xs font-semibold text-brand-teal hover:underline">
              <Icon icon={Users} size="sm" className="mr-1 inline align-text-bottom" /> {assignment._count.submissions} Submission{assignment._count.submissions === 1 ? "" : "s"}
            </Link>
            <Link href={`/admin/assignments/${params.id}/analytics`} className="text-xs font-semibold text-brand-teal hover:underline">
              <Icon icon={BarChart3} size="sm" className="mr-1 inline align-text-bottom" /> Analytics
            </Link>
          </div>
        </div>
      </div>

      {issues && issues.length > 0 && (
        <div className="mt-4 rounded-lg border border-brand-goldLight bg-brand-goldLight/40 p-4">
          <p className="text-sm font-semibold text-brand-goldText">
            <Icon icon={AlertTriangle} size="sm" className="mr-1 inline align-text-bottom" /> {issues.length} issue{issues.length === 1 ? "" : "s"} found
          </p>
          <ul className="mt-2 space-y-1 text-xs text-brand-goldText">
            {issues.map((issue, i) => (
              <li key={i}>
                {issue.severity === "blocker" ? "🚫 " : "⚠️ "}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <AssignmentSettings assignment={assignment} onSave={updateAssignment} showToast={showToast} />

      <div className="mt-8 space-y-3">
        <h2 className="font-display text-lg font-semibold text-brand-ink">Questions ({assignment.questions.length})</h2>
        {assignment.questions.map((q) => (
          <QuestionCard key={q.id} assignmentId={params.id} question={q} onChanged={load} onDelete={() => deleteQuestion(q.id)} showToast={showToast} />
        ))}
        <AddQuestionForm assignmentId={params.id} onAdded={load} showToast={showToast} />
      </div>
    </main>
  );
}

function AssignmentSettings({
  assignment,
  onSave,
  showToast,
}: {
  assignment: AssignmentDto;
  onSave: (data: Partial<AssignmentDto>) => Promise<string | null>;
  showToast: (message: string, variant?: "success" | "error") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dueAt, setDueAt] = useState(assignment.dueAt ? assignment.dueAt.slice(0, 10) : "");
  const [lateSubmissionPolicy, setLateSubmissionPolicy] = useState(assignment.lateSubmissionPolicy);
  const [allowEditAfterSubmission, setAllowEditAfterSubmission] = useState(assignment.allowEditAfterSubmission);
  const [aiAssessmentEnabled, setAiAssessmentEnabled] = useState(assignment.aiAssessmentEnabled);
  const [resubmissionPolicy, setResubmissionPolicy] = useState(assignment.resubmissionPolicy);
  const [maxResubmissions, setMaxResubmissions] = useState(assignment.maxResubmissions?.toString() ?? "");
  const [resubmissionScope, setResubmissionScope] = useState(assignment.resubmissionScope);
  const [failedQuestionThresholdPercent, setFailedQuestionThresholdPercent] = useState(assignment.failedQuestionThresholdPercent.toString());
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setDueAt(assignment.dueAt ? assignment.dueAt.slice(0, 10) : "");
    setLateSubmissionPolicy(assignment.lateSubmissionPolicy);
    setAllowEditAfterSubmission(assignment.allowEditAfterSubmission);
    setAiAssessmentEnabled(assignment.aiAssessmentEnabled);
    setResubmissionPolicy(assignment.resubmissionPolicy);
    setMaxResubmissions(assignment.maxResubmissions?.toString() ?? "");
    setResubmissionScope(assignment.resubmissionScope);
    setFailedQuestionThresholdPercent(assignment.failedQuestionThresholdPercent.toString());
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    const err = await onSave({
      dueAt: dueAt ? (new Date(dueAt) as unknown as string) : null,
      lateSubmissionPolicy,
      allowEditAfterSubmission,
      aiAssessmentEnabled,
      resubmissionPolicy,
      maxResubmissions: resubmissionPolicy === "LIMITED" && maxResubmissions.trim() ? (Number(maxResubmissions) as unknown as number) : null,
      resubmissionScope,
      failedQuestionThresholdPercent: Number(failedQuestionThresholdPercent) || 50,
    });
    setSaving(false);
    if (err) {
      showToast(err, "error");
      return;
    }
    setEditing(false);
    showToast("Settings saved.");
  }

  return (
    <div className="mt-4 rounded-lg border border-brand-gray bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Settings</p>
        {!editing && <button onClick={startEditing} className="text-xs font-semibold text-brand-teal hover:underline">Edit</button>}
      </div>
      {!editing ? (
        <p className="mt-2 text-xs text-gray-600">
          {assignment.dueAt ? `Due ${new Date(assignment.dueAt).toLocaleDateString()}` : "No due date"} ·{" "}
          Late submissions: {assignment.lateSubmissionPolicy.replace(/_/g, " ").toLowerCase()} ·{" "}
          AI assessment: <strong>{assignment.aiAssessmentEnabled ? "On" : "Off (manual grading)"}</strong> ·{" "}
          Resubmission: {assignment.resubmissionPolicy.toLowerCase()}
          {assignment.resubmissionPolicy !== "NONE" &&
            ` (${assignment.resubmissionScope === "FAILED_QUESTIONS_ONLY" ? `only questions scoring below ${assignment.failedQuestionThresholdPercent}%` : "full assignment"})`}
          {assignment.allowEditAfterSubmission && " · Editing allowed after submission"}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-3">
            <Input label="Due date (optional)" compact type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            <Select label="Late submissions" compact value={lateSubmissionPolicy} onChange={(e) => setLateSubmissionPolicy(e.target.value as AssignmentDto["lateSubmissionPolicy"])}>
                <option value="ALLOWED">Allowed</option>
                <option value="ALLOWED_WITH_FLAG">Allowed, flagged as late</option>
                <option value="NOT_ALLOWED">Not allowed</option>
              </Select>
          </div>
          <Checkbox label="Allow trainees to keep editing after submitting" checked={allowEditAfterSubmission} onChange={(e) => setAllowEditAfterSubmission(e.target.checked)} />
          <Checkbox label="AI grades submissions automatically (unchecked: every submission is emailed to you as a PDF for manual grading)" checked={aiAssessmentEnabled} onChange={(e) => setAiAssessmentEnabled(e.target.checked)} />
          <div className="flex flex-wrap items-end gap-3">
            <Select label="Resubmission policy" compact value={resubmissionPolicy} onChange={(e) => setResubmissionPolicy(e.target.value as AssignmentDto["resubmissionPolicy"])}>
                <option value="NONE">No resubmission</option>
                <option value="ONE">One resubmission</option>
                <option value="LIMITED">Limited number</option>
                <option value="UNLIMITED">Unlimited</option>
              </Select>
            {resubmissionPolicy === "LIMITED" && (
              <Input label="Max resubmissions" compact wrapperClassName="w-24" type="number" min={1} value={maxResubmissions} onChange={(e) => setMaxResubmissions(e.target.value)} />
            )}
          </div>
          {resubmissionPolicy !== "NONE" && (
            <div className="flex flex-wrap items-end gap-3">
              <Select label="What a trainee must redo" compact value={resubmissionScope} onChange={(e) => setResubmissionScope(e.target.value as AssignmentDto["resubmissionScope"])}>
                  <option value="FULL_ASSIGNMENT">Full assignment</option>
                  <option value="FAILED_QUESTIONS_ONLY">Only questions they failed</option>
                </Select>
              {resubmissionScope === "FAILED_QUESTIONS_ONLY" && (
                <Input label="Failing threshold (%)" compact wrapperClassName="w-24" type="number" min={1} max={99} value={failedQuestionThresholdPercent} onChange={(e) => setFailedQuestionThresholdPercent(e.target.value)} />
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
            <button onClick={() => setEditing(false)} className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  assignmentId,
  question,
  onChanged,
  onDelete,
  showToast,
}: {
  assignmentId: string;
  question: QuestionDto;
  onChanged: () => void;
  onDelete: () => void;
  showToast: (message: string, variant?: "success" | "error") => void;
}) {
  const [expanded, setExpanded] = useState(question.needsReview);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(questionToForm(question));
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setForm(questionToForm(question));
    setEditing(true);
    setExpanded(true);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/admin/assignments/${assignmentId}/questions/${question.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form)),
    });
    setSaving(false);
    if (!res.ok) {
      showToast(await readApiError(res, "Could not save the question."), "error");
      return;
    }
    setEditing(false);
    showToast("Question saved.");
    onChanged();
  }

  return (
    <div className={`rounded-lg border ${question.needsReview ? "border-brand-gold" : "border-brand-gray"}`}>
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full items-center justify-between gap-2 p-4 text-left">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">
            <Icon icon={expanded ? ChevronDown : ChevronRight} size="sm" className="mr-1 inline align-text-bottom" />
            Question {question.questionNumber} <span className="font-normal text-gray-500">({question.type.replace(/_/g, " ").toLowerCase()}, {question.maxMarks} marks)</span>
          </p>
          <p className="mt-0.5 truncate text-sm text-gray-600">{question.questionText}</p>
          {question.needsReview && (
            <p className="mt-1 text-xs font-semibold text-brand-goldText">
              <Icon icon={AlertTriangle} size="sm" className="mr-1 inline align-text-bottom" /> {question.reviewReason}
            </p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-brand-gray p-4">
          {!editing ? (
            <>
              {question.instructions && <p className="text-sm text-gray-600"><strong>Instructions:</strong> {question.instructions}</p>}
              <p className="mt-2 text-sm text-gray-600"><strong>Expected answer:</strong> {question.expectedAnswer ?? <span className="text-gray-400">None provided</span>}</p>
              <p className="mt-2 text-sm text-gray-600"><strong>Expected concepts:</strong> {question.expectedConcepts?.join(", ") || <span className="text-gray-400">None provided</span>}</p>
              {question.rubric && question.rubric.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  <strong>Rubric:</strong>
                  <ul className="mt-1 list-disc pl-5">
                    {question.rubric.map((c, i) => <li key={i}>{c.name} — {c.maxMarks} marks{c.description ? `: ${c.description}` : ""}</li>)}
                  </ul>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button onClick={startEditing} className="text-xs font-semibold text-brand-teal hover:underline">Edit</button>
                <button onClick={onDelete} className="text-xs font-semibold text-brand-rose hover:underline">Delete</button>
              </div>
            </>
          ) : (
            <QuestionEditForm form={form} setForm={setForm} onSave={handleSave} onCancel={() => setEditing(false)} saving={saving} />
          )}
        </div>
      )}
    </div>
  );
}

interface QuestionForm {
  questionNumber: string;
  type: QuestionType;
  questionText: string;
  instructions: string;
  expectedAnswer: string;
  expectedConcepts: string;
  maxMarks: string;
  rubricText: string;
}

function questionToForm(q: QuestionDto): QuestionForm {
  return {
    questionNumber: q.questionNumber,
    type: q.type,
    questionText: q.questionText,
    instructions: q.instructions ?? "",
    expectedAnswer: q.expectedAnswer ?? "",
    expectedConcepts: q.expectedConcepts?.join(", ") ?? "",
    maxMarks: String(q.maxMarks),
    rubricText: q.rubric?.map((c) => `${c.name} — ${c.maxMarks}`).join("\n") ?? "",
  };
}

function parseRubricText(text: string): RubricCriterion[] | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const criteria: RubricCriterion[] = [];
  for (const line of lines) {
    const match = line.match(/^(.+?)\s*[—-]\s*(\d+)\s*$/);
    if (match) criteria.push({ name: match[1].trim(), maxMarks: parseInt(match[2], 10), description: null });
  }
  return criteria.length > 0 ? criteria : null;
}

function formToPayload(form: QuestionForm) {
  return {
    questionNumber: form.questionNumber,
    type: form.type,
    questionText: form.questionText,
    instructions: form.instructions || null,
    expectedAnswer: form.expectedAnswer || null,
    expectedConcepts: form.expectedConcepts.trim() ? form.expectedConcepts.split(",").map((s) => s.trim()).filter(Boolean) : null,
    maxMarks: Number(form.maxMarks) || 0,
    rubric: parseRubricText(form.rubricText),
  };
}

function QuestionEditForm({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
}: {
  form: QuestionForm;
  setForm: (f: QuestionForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Input label="Question number" compact wrapperClassName="w-24" value={form.questionNumber} onChange={(e) => setForm({ ...form, questionNumber: e.target.value })} />
        <Select label="Type" compact value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as QuestionType })}>
            {QUESTION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </Select>
        <Input label="Marks" compact wrapperClassName="w-20" type="number" min={1} value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} />
      </div>
      <Textarea label="Question text" compact value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} rows={3} />
      <Input label="Instructions (optional)" compact value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
      <Textarea label="Expected answer (optional — grading is understanding-based, not exact-match)" compact value={form.expectedAnswer} onChange={(e) => setForm({ ...form, expectedAnswer: e.target.value })} rows={2} />
      <Input label="Expected concepts (comma-separated, optional)" compact value={form.expectedConcepts} onChange={(e) => setForm({ ...form, expectedConcepts: e.target.value })} placeholder="missing data, consistency, reliable analysis" />
      <Textarea label="Rubric (optional — one criterion per line, &quot;Name — marks&quot;)" compact controlClassName="font-mono" value={form.rubricText} onChange={(e) => setForm({ ...form, rubricText: e.target.value })} rows={3} placeholder={"Understanding — 3\nAccuracy — 3\nApplication — 2\nExplanation — 2"} />
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving} className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
        <button onClick={onCancel} className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold">Cancel</button>
      </div>
    </div>
  );
}

function AddQuestionForm({ assignmentId, onAdded, showToast }: { assignmentId: string; onAdded: () => void; showToast: (m: string, v?: "success" | "error") => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<QuestionForm>({ questionNumber: "", type: "SHORT_ANSWER", questionText: "", instructions: "", expectedAnswer: "", expectedConcepts: "", maxMarks: "10", rubricText: "" });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.questionNumber.trim() || !form.questionText.trim()) {
      showToast("Question number and text are required.", "error");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/assignments/${assignmentId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form)),
    });
    setSaving(false);
    if (!res.ok) {
      showToast(await readApiError(res, "Could not add the question."), "error");
      return;
    }
    setForm({ questionNumber: "", type: "SHORT_ANSWER", questionText: "", instructions: "", expectedAnswer: "", expectedConcepts: "", maxMarks: "10", rubricText: "" });
    setAdding(false);
    showToast("Question added.");
    onAdded();
  }

  if (!adding) {
    return (
      <button onClick={() => setAdding(true)} className="w-full rounded-lg border border-dashed border-brand-gray py-3 text-sm font-semibold text-gray-600 hover:border-brand-teal hover:text-brand-teal">
        + Add Question
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-brand-teal p-4">
      <QuestionEditForm form={form} setForm={setForm} onSave={handleSave} onCancel={() => setAdding(false)} saving={saving} />
    </div>
  );
}
