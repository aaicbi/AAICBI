"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { AlertTriangle } from "lucide-react";
import Icon from "@/components/ui/Icon";
import CorrectnessMark from "@/components/ui/CorrectnessMark";

interface OptionDto {
  id: string;
  text: string;
  isCorrect: boolean;
}
interface ValidationDetail {
  correctness?: { agrees: boolean; verifiedOptionIndex: number | null; originalOptionIndex: number };
  alignment?: { aligned: boolean; reason: string | null };
  ambiguity?: { ambiguous: boolean; reason: string | null };
  duplicate?: { matchedQuestionId: string | null; matchedQuestionText: string; similarity: number } | null;
  duplicateCheckSkipped?: boolean;
}
interface QuestionDto {
  id: string;
  text: string;
  topic: string | null;
  explanation: string | null;
  bankStatus: string | null;
  options: OptionDto[];
  bankObjective: { id: string; text: string } | null;
  sourceMaterials: { material: { title: string } }[];
  bankEvents: { detail: ValidationDetail | null; note: string | null; createdAt: string }[];
}
interface PageData {
  module: { id: string; title: string; courseTitle: string };
  objectives: { id: string; text: string }[];
  examId: string | null;
  gate1: QuestionDto[];
  gate2: QuestionDto[];
}

const STATUS_LABEL: Record<string, string> = {
  VALIDATED_WARNING: "Possible near-duplicate",
  VALIDATED_FLAGGED: "Objective/ambiguity concern",
  VALIDATED_REJECTED: "Possible wrong answer",
};

/**
 * /admin/modules/[id]/question-bank — the two human checkpoints Loop
 * Question Bank's whole design rests on, as a plain in-app screen, NOT
 * Loop-mediated at all. Modeled directly on
 * admin/exams/[id]/import/page.tsx's own review-card pattern (this
 * app's existing "AI proposed this, a human clicks Approve/Edit/
 * Reject" precedent), with two tabs instead of that page's single
 * list: Gate 1 for freshly generated questions awaiting a first human
 * look, Gate 2 for questions independent validation flagged and that
 * need a second one. A clean VALIDATED_PASS question never appears
 * here at all — it's already auto-approved into the live bank (see
 * validateBankQuestions.ts).
 */
export default function QuestionBankReviewPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<PageData | null>(null);
  const [tab, setTab] = useState<"gate1" | "gate2">("gate1");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { confirm, modal } = useConfirmModal();
  const { showToast } = useToast();

  async function load() {
    const res = await fetch(`/api/modules/${params.id}/question-bank`);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function actOnQuestion(gate: "gate1" | "gate2", questionId: string, action: "approve" | "reject", editedText?: string, editedOptions?: OptionDto[]) {
    const res = await fetch(`/api/questions/${questionId}/bank/${gate}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...(editedText ? { editedText } : {}),
        ...(editedOptions ? { editedOptions: editedOptions.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(typeof body.error === "string" ? body.error : "That action couldn't be completed.", "error");
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
    await load();
  }

  async function rejectWithConfirm(gate: "gate1" | "gate2", questionId: string) {
    const ok = await confirm({
      title: "Reject this question?",
      description: "It will be kept for audit purposes but will never enter the live question bank.",
      confirmLabel: "Reject",
      danger: true,
    });
    if (!ok) return;
    await actOnQuestion(gate, questionId, "reject");
  }

  async function bulkApprove() {
    if (!data?.examId || selected.size === 0) return;
    const res = await fetch(`/api/exams/${data.examId}/bank/gate1-bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIds: Array.from(selected) }),
    });
    if (!res.ok) {
      showToast("Bulk approve failed. Try again.", "error");
      return;
    }
    const body = await res.json();
    showToast(`Approved ${body.approved} question(s) for validation.`, "success");
    setSelected(new Set());
    await load();
  }

  const nav = [
    { label: "Examinations", href: "/admin/dashboard" },
    { label: "Courses", href: "/admin/courses" },
    { label: "Command", href: "/admin/command" },
    { label: "Settings", href: "/admin/settings" },
  ];

  if (!data) {
    return (
      <>
        <SiteHeader nav={nav} right={<LogoutButton />} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="h-6 w-40 animate-pulse rounded-full bg-brand-gray/60" />
          <div className="mt-3 h-8 w-72 animate-pulse rounded-full bg-brand-gray/60" />
        </main>
      </>
    );
  }

  const questions = tab === "gate1" ? data.gate1 : data.gate2;

  return (
    <>
      <SiteHeader nav={nav} right={<LogoutButton />} />
      {modal}
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900">Question Bank Review</h1>
        <p className="text-sm text-gray-500">
          {data.module.courseTitle} — {data.module.title}
        </p>

        {data.objectives.length > 0 && (
          <div className="mt-4 rounded-lg border border-brand-gray p-4 text-sm">
            <span className="font-semibold text-gray-900">Confirmed objectives — </span>
            {data.objectives.map((o) => o.text).join("; ")}
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500">
          To generate more questions or run validation, ask Loop from the{" "}
          <a href="/admin/command" className="text-brand-teal hover:underline">
            Command Center
          </a>
          .
        </p>

        <div className="mt-6 flex gap-2 border-b border-brand-gray">
          <button
            onClick={() => setTab("gate1")}
            className={`px-3 py-2 text-sm font-semibold ${tab === "gate1" ? "border-b-2 border-brand-teal text-brand-teal" : "text-gray-500"}`}
          >
            First review ({data.gate1.length})
          </button>
          <button
            onClick={() => setTab("gate2")}
            className={`px-3 py-2 text-sm font-semibold ${tab === "gate2" ? "border-b-2 border-brand-teal text-brand-teal" : "text-gray-500"}`}
          >
            Second review ({data.gate2.length})
          </button>
        </div>

        {tab === "gate1" && selected.size > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-brand-teal bg-brand-mint/30 p-3 text-sm">
            <span>{selected.size} selected</span>
            <button onClick={bulkApprove} className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white">
              Approve selected for validation
            </button>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {questions.length === 0 && <p className="text-sm text-gray-500">Nothing here right now.</p>}
          {questions.map((q) =>
            tab === "gate1" ? (
              <Gate1Card
                key={q.id}
                question={q}
                selected={selected.has(q.id)}
                onToggleSelect={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    next.has(q.id) ? next.delete(q.id) : next.add(q.id);
                    return next;
                  })
                }
                onApprove={() => actOnQuestion("gate1", q.id, "approve")}
                onReject={() => rejectWithConfirm("gate1", q.id)}
                onSave={(text, options) => actOnQuestion("gate1", q.id, "approve", text, options)}
              />
            ) : (
              <Gate2Card
                key={q.id}
                question={q}
                onApprove={() => actOnQuestion("gate2", q.id, "approve")}
                onReject={() => rejectWithConfirm("gate2", q.id)}
                onSave={(text, options) => actOnQuestion("gate2", q.id, "approve", text, options)}
              />
            )
          )}
        </div>
      </main>
    </>
  );
}

function QuestionEditor({
  question,
  onSave,
  onCancel,
}: {
  question: QuestionDto;
  onSave: (text: string, options: OptionDto[]) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(question.text);
  const [options, setOptions] = useState(question.options);

  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded border border-brand-gray p-2" rows={3} />
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
        <button onClick={() => onSave(text, options)} className="rounded-lg bg-brand-teal px-3 py-1.5 text-sm font-semibold text-white">
          Save &amp; approve
        </button>
        <button onClick={onCancel} className="rounded border border-brand-gray px-3 py-1.5 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}

function QuestionBody({ question }: { question: QuestionDto }) {
  return (
    <div>
      <p className="font-medium text-gray-900">{question.text}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {question.options.map((o) => (
          <li key={o.id} className={o.isCorrect ? "flex items-center gap-1 font-semibold text-brand-teal" : "text-gray-600"}>
            {o.text} {o.isCorrect && <CorrectnessMark state="correct" label="Correct answer" />}
          </li>
        ))}
      </ul>
      {question.explanation && <p className="mt-2 text-xs text-gray-500">Explanation: {question.explanation}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        {question.bankObjective && <span className="rounded bg-gray-100 px-2 py-0.5">Objective: {question.bankObjective.text}</span>}
        {question.topic && <span className="rounded bg-gray-100 px-2 py-0.5">{question.topic}</span>}
        {question.sourceMaterials.map((sm, i) => (
          <span key={i} className="rounded bg-gray-100 px-2 py-0.5">
            Source: {sm.material.title}
          </span>
        ))}
      </div>
    </div>
  );
}

function Gate1Card({
  question,
  selected,
  onToggleSelect,
  onApprove,
  onReject,
  onSave,
}: {
  question: QuestionDto;
  selected: boolean;
  onToggleSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSave: (text: string, options: OptionDto[]) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-lg border border-brand-gray p-4">
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} className="mt-1.5 accent-brand-teal" />
        <div className="flex-1">
          {editing ? (
            <QuestionEditor
              question={question}
              onSave={(text, options) => {
                onSave(text, options);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <QuestionBody question={question} />
              <div className="mt-3 flex gap-2">
                <button onClick={() => setEditing(true)} className="rounded border border-brand-gray px-3 py-1.5 text-xs font-semibold hover:border-brand-teal">
                  Edit
                </button>
                <button onClick={onApprove} className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white">
                  Approve for validation
                </button>
                <button onClick={onReject} className="rounded border border-brand-roseLight px-3 py-1.5 text-xs font-semibold text-brand-rose hover:bg-brand-roseLight/40">
                  Reject
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Gate2Card({
  question,
  onApprove,
  onReject,
  onSave,
}: {
  question: QuestionDto;
  onApprove: () => void;
  onReject: () => void;
  onSave: (text: string, options: OptionDto[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const detail = question.bankEvents[0]?.detail;

  return (
    <div className="rounded-lg border border-brand-gold bg-brand-goldLight/30 p-4">
      <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-brand-goldText">
        <Icon icon={AlertTriangle} size="sm" /> {question.bankStatus ? STATUS_LABEL[question.bankStatus] ?? "Flagged" : "Flagged"}
      </p>

      {detail && (
        <div className="mb-3 space-y-1 rounded border border-brand-gray bg-white p-3 text-xs text-gray-700">
          {detail.correctness && !detail.correctness.agrees && (
            <p>
              Independent check believes option {detail.correctness.verifiedOptionIndex ?? "?"} is correct, not option{" "}
              {detail.correctness.originalOptionIndex}.
            </p>
          )}
          {detail.alignment && !detail.alignment.aligned && <p>Objective alignment concern: {detail.alignment.reason ?? "not specified."}</p>}
          {detail.ambiguity?.ambiguous && <p>Ambiguity concern: {detail.ambiguity.reason ?? "not specified."}</p>}
          {detail.duplicate && (
            <p>
              Possible duplicate ({Math.round(detail.duplicate.similarity * 100)}% similar): "{detail.duplicate.matchedQuestionText}"
            </p>
          )}
          {detail.duplicateCheckSkipped && <p className="italic text-gray-400">Duplicate check was skipped (not configured).</p>}
        </div>
      )}

      {editing ? (
        <QuestionEditor
          question={question}
          onSave={(text, options) => {
            onSave(text, options);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <QuestionBody question={question} />
          <div className="mt-3 flex gap-2">
            <button onClick={() => setEditing(true)} className="rounded border border-brand-gray px-3 py-1.5 text-xs font-semibold hover:border-brand-teal">
              Edit
            </button>
            <button onClick={onApprove} className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white">
              Approve
            </button>
            <button onClick={onReject} className="rounded border border-brand-roseLight px-3 py-1.5 text-xs font-semibold text-brand-rose hover:bg-brand-roseLight/40">
              Reject
            </button>
          </div>
        </>
      )}
    </div>
  );
}
