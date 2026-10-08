"use client";
import { Textarea } from "@/components/ui/Field";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import { TRAINEE_NAV } from "@/lib/trainee/nav";
import Button from "@/components/ui/Button";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import { useToast } from "@/components/ui/Toast";

interface QuestionDto {
  id: string;
  section: string | null;
  questionNumber: string;
  type: string;
  questionText: string;
  instructions: string | null;
  referenceMaterial: string | null;
  maxMarks: number;
  order: number;
}

interface SubmissionAnswer {
  id: string;
  questionId: string;
  answerText: string | null;
  lastSavedAt: string | null;
  aiScore: number | null;
  instructorScore: number | null;
}

interface AssignmentDetail {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  dueAt: string | null;
  allowEditAfterSubmission: boolean;
  questions: QuestionDto[];
  submission: { id: string; status: string; answers: SubmissionAnswer[] };
}

const AUTOSAVE_DEBOUNCE_MS = 2000;

export default function AssignmentWorkspacePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<Record<string, { status: "idle" | "saving" | "saved"; savedAt: Date | null }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [unlockedCarryForward, setUnlockedCarryForward] = useState<Record<string, boolean>>({});
  const { confirm, modal } = useConfirmModal();
  const { showToast } = useToast();
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    fetch(`/api/trainee/assignments/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: AssignmentDetail) => {
        setAssignment(data);
        const initialAnswers: Record<string, string> = {};
        const initialSaveState: typeof saveState = {};
        for (const a of data.submission.answers) {
          initialAnswers[a.questionId] = a.answerText ?? "";
          initialSaveState[a.questionId] = { status: "saved", savedAt: a.lastSavedAt ? new Date(a.lastSavedAt) : null };
        }
        setAnswers(initialAnswers);
        setSaveState(initialSaveState);
      })
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const saveAnswer = useCallback(
    async (questionId: string, text: string) => {
      setSaveState((s) => ({ ...s, [questionId]: { status: "saving", savedAt: s[questionId]?.savedAt ?? null } }));
      const res = await fetch(`/api/trainee/assignments/${params.id}/answers/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerText: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaveState((s) => ({ ...s, [questionId]: { status: "saved", savedAt: new Date(data.savedAt) } }));
      } else {
        setSaveState((s) => ({ ...s, [questionId]: { status: "idle", savedAt: s[questionId]?.savedAt ?? null } }));
        showToast("Could not save your answer. Check your connection.", "error");
      }
    },
    [params.id, showToast]
  );

  // Answers are the trainee's own words: pasting (and dropping text in) is blocked.
  function blockClipboard(e: React.SyntheticEvent) {
    e.preventDefault();
    showToast("Pasting is turned off here. Please type your answer in your own words.", "error");
  }

  function handleAnswerChange(questionId: string, text: string) {
    setAnswers((a) => ({ ...a, [questionId]: text }));
    if (debounceTimers.current[questionId]) clearTimeout(debounceTimers.current[questionId]);
    debounceTimers.current[questionId] = setTimeout(() => saveAnswer(questionId, text), AUTOSAVE_DEBOUNCE_MS);
  }

  async function handleSubmit() {
    const ok = await confirm({
      title: "Submit this assignment?",
      description: assignment?.allowEditAfterSubmission
        ? "You can still make changes after submitting."
        : "Once submitted, you won't be able to change your answers unless your instructor asks for a resubmission.",
      confirmLabel: "Submit",
    });
    if (!ok) return;
    setSubmitting(true);
    const res = await fetch(`/api/trainee/assignments/${params.id}/submit`, { method: "POST" });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not submit. Try again.", "error");
      return;
    }
    router.push(`/trainee/assignments/${params.id}/result`);
  }

  if (notFound) return <main className="mx-auto max-w-2xl px-6 py-10 text-center text-gray-600">Assignment not found.</main>;
  if (!assignment) return <main className="mx-auto max-w-3xl px-6 py-10"><SkeletonList /></main>;

  if (assignment.submission.status !== "IN_PROGRESS" && !assignment.allowEditAfterSubmission) {
    return (
      <>
        <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-lg px-6 py-16 text-center">
          <p className="text-gray-600">You&apos;ve already submitted this assignment.</p>
          <Button href={`/trainee/assignments/${params.id}/result`} className="mt-4">View Your Result</Button>
        </main>
      </>
    );
  }

  const sortedQuestions = [...assignment.questions].sort((a, b) => a.order - b.order);
  const activeQuestion = sortedQuestions[activeIndex];
  const answeredCount = sortedQuestions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;
  const activeSave = saveState[activeQuestion.id];

  // FAILED_QUESTIONS_ONLY resubmission carries a passing question's
  // answer AND score forward onto this still-IN_PROGRESS submission —
  // a non-null score here means "already graded," never a fresh attempt.
  const carriedForwardQuestionIds = new Set(
    assignment.submission.answers.filter((a) => a.aiScore !== null || a.instructorScore !== null).map((a) => a.questionId)
  );
  const activeIsCarriedForward = activeIndex >= 0 && carriedForwardQuestionIds.has(activeQuestion.id) && !unlockedCarryForward[activeQuestion.id];

  return (
    <>
      {modal}
      <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[14rem_1fr_16rem]">
        {/* Left: question navigation */}
        <aside className="order-2 lg:order-1">
          <div className="rounded-lg border border-brand-gray bg-brand-surface p-3 lg:sticky lg:top-6">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Questions</p>
            <nav className="mt-2 flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {assignment.instructions && (
                <button
                  onClick={() => setActiveIndex(-1)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-semibold ${activeIndex === -1 ? "bg-brand-mint text-brand-teal" : "text-gray-600 hover:bg-brand-mint"}`}
                >
                  Instructions
                </button>
              )}
              {sortedQuestions.map((q, i) => {
                const answered = (answers[q.id] ?? "").trim().length > 0;
                const carriedForward = carriedForwardQuestionIds.has(q.id) && !unlockedCarryForward[q.id];
                return (
                  <button
                    key={q.id}
                    onClick={() => setActiveIndex(i)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-semibold ${i === activeIndex ? "bg-brand-mint text-brand-teal" : "text-gray-600 hover:bg-brand-mint"}`}
                  >
                    Q{q.questionNumber} {carriedForward ? <span title="Already scored">🔒</span> : answered && <span className="text-brand-teal">✓</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main: current question + answer editor */}
        <div className="order-1 lg:order-2">
          <h1 className="font-display text-xl font-semibold text-brand-ink">{assignment.title}</h1>

          {activeIndex === -1 ? (
            <div className="mt-4 rounded-lg border border-brand-gray bg-brand-surface p-5">
              <p className="font-display font-semibold text-brand-ink">Instructions</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{assignment.instructions}</p>
              <Button onClick={() => setActiveIndex(0)} className="mt-4">Start Question 1</Button>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-brand-gray bg-brand-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">
                Question {activeQuestion.questionNumber} · {activeQuestion.maxMarks} marks
              </p>
              <p className="mt-2 whitespace-pre-wrap font-display text-base font-semibold text-brand-ink">{activeQuestion.questionText}</p>
              {activeQuestion.instructions && <p className="mt-2 text-sm text-gray-600">{activeQuestion.instructions}</p>}
              {activeQuestion.referenceMaterial && (
                <div className="mt-2 rounded-lg border border-brand-gray bg-gray-50 p-3 text-sm text-gray-600">{activeQuestion.referenceMaterial}</div>
              )}

              {activeIsCarriedForward && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-brand-mint/40 p-3 text-sm text-brand-ink">
                  <span>Already scored — no changes needed.</span>
                  <button
                    type="button"
                    onClick={() => setUnlockedCarryForward((u) => ({ ...u, [activeQuestion.id]: true }))}
                    className="shrink-0 text-xs font-semibold text-brand-teal hover:underline"
                  >
                    Edit anyway
                  </button>
                </div>
              )}

              <div className="mt-4">
                <Textarea
                  label="Your answer"
                  hideLabel
                  value={answers[activeQuestion.id] ?? ""}
                  onChange={(e) => handleAnswerChange(activeQuestion.id, e.target.value)}
                  onPaste={blockClipboard}
                  onDrop={blockClipboard}
                  rows={activeQuestion.type === "TECHNICAL_RESPONSE" ? 14 : 10}
                  placeholder="Type your answer here..."
                  disabled={activeIsCarriedForward}
                  controlClassName={`px-4 py-3 ${activeQuestion.type === "TECHNICAL_RESPONSE" ? "font-mono" : ""}`}
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  {activeIsCarriedForward
                    ? "Carried forward from your previous attempt."
                    : activeSave?.status === "saving" ? "Saving..." : activeSave?.savedAt ? `Saved ${formatRelativeTime(activeSave.savedAt)}` : "Not saved yet"}
                </p>
              </div>

              <div className="mt-4 flex justify-between">
                <Button variant="secondary" size="sm" onClick={() => setActiveIndex((i) => Math.max(0, i - 1))} disabled={activeIndex === 0}>
                  Previous
                </Button>
                {activeIndex < sortedQuestions.length - 1 ? (
                  <Button size="sm" onClick={() => setActiveIndex((i) => i + 1)}>Next Question</Button>
                ) : (
                  <Button size="sm" onClick={handleSubmit} loading={submitting}>Submit Assignment</Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: progress / status */}
        <aside className="order-3">
          <div className="rounded-lg border border-brand-gray bg-brand-surface p-4 lg:sticky lg:top-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Progress</p>
            <p className="mt-1 text-2xl font-display font-semibold text-brand-ink">{answeredCount}/{sortedQuestions.length}</p>
            <p className="text-xs text-gray-500">questions answered</p>
            {assignment.dueAt && (
              <p className="mt-3 text-xs text-gray-600">Due: {new Date(assignment.dueAt).toLocaleDateString()}</p>
            )}
            <Button onClick={handleSubmit} loading={submitting} className="mt-4 w-full">Submit Assignment</Button>
          </div>
        </aside>
      </main>
    </>
  );
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}
