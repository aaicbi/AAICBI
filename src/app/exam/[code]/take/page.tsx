"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Timer from "@/components/exam/Timer";
import { NavigationGrid } from "@/components/exam/NavigationPanel";
import Logo from "@/components/Logo";
import Button from "@/components/ui/Button";

interface AttemptData {
  attemptId: string;
  examTitle: string;
  secondsRemaining: number;
  allowReview: boolean;
  monitoringEnabled?: boolean;
  questions: { id: string; text: string; options: { key: string; text: string }[] }[];
}

export default function TakeExamPage({ params }: { params: { code: string } }) {
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [navOpen, setNavOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const clientStartedAtRef = useRef<number>(0);
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem(`cbt_attempt_${params.code}`);
    const startedRaw = sessionStorage.getItem(`cbt_attempt_start_${params.code}`);
    if (!raw || !startedRaw) {
      router.replace(`/exam/${params.code}`);
      return;
    }
    setAttempt(JSON.parse(raw));
    clientStartedAtRef.current = Number(startedRaw);
  }, [params.code, router]);

  // Optional monitoring (§21) — only wired up when the exam has it
  // enabled, and only ever logs events; it never blocks the student.
  useEffect(() => {
    if (!attempt?.monitoringEnabled) return;
    const log = (eventType: string) => {
      fetch(`/api/attempts/${attempt.attemptId}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType }),
      }).catch(() => {});
    };
    const onVisibility = () => document.hidden && log("tab_hidden");
    const onBlur = () => log("window_blur");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [attempt?.monitoringEnabled, attempt?.attemptId]);

  const answeredIndices = useMemo(() => {
    if (!attempt) return new Set<number>();
    const set = new Set<number>();
    attempt.questions.forEach((q, i) => {
      if (answers[q.id]) set.add(i);
    });
    return set;
  }, [answers, attempt]);

  async function selectAnswer(questionId: string, key: string) {
    if (!attempt) return;
    setAnswers((a) => ({ ...a, [questionId]: key }));
    // Fire-and-forget with a simple retry — §34: preserve answers locally,
    // sync when connectivity returns. Local state above is already
    // updated, so a flaky network never loses the student's on-screen
    // choice; worst case this particular save retries on the next click.
    try {
      await fetch(`/api/attempts/${attempt.attemptId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, selectedOptionKey: key }),
      });
    } catch {
      /* local state already has it; next interaction or submit will retry */
    }
  }

  function toggleMark(index: number) {
    setMarked((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  async function doSubmit() {
    if (!attempt) return;
    setSubmitting(true);
    const res = await fetch(`/api/attempts/${attempt.attemptId}/submit`, { method: "POST" });
    const data = await res.json();
    sessionStorage.setItem(`cbt_result_${params.code}`, JSON.stringify(data));
    sessionStorage.removeItem(`cbt_attempt_${params.code}`);
    router.push(`/exam/${params.code}/result`);
  }

  if (!attempt) {
    return (
      <div className="min-h-screen bg-white dark:bg-brand-sand p-6">
        <div className="mx-auto max-w-5xl">
          <div className="h-10 w-full animate-pulse rounded-lg bg-brand-gray/40" />
          <div className="mt-8 h-64 max-w-2xl animate-pulse rounded-xl bg-brand-gray/30" />
        </div>
      </div>
    );
  }

  const question = attempt.questions[current];
  const unansweredCount = attempt.questions.length - answeredIndices.size;

  return (
    <div className="min-h-screen bg-white dark:bg-brand-sand">
      {/* Top bar — timer stays visible on mobile per §22. Logo is
          deliberately non-clickable here (href={null}) — a "way out"
          link during a live, timed, possibly-monitored exam would be
          actively unwelcome, unlike on every other page in the app. */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-gray bg-white dark:bg-brand-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Logo href={null} compact />
          <span className="truncate font-display text-sm font-semibold text-brand-ink">{attempt.examTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <Timer
            initialSecondsRemaining={attempt.secondsRemaining}
            clientStartedAt={clientStartedAtRef.current}
            onExpire={doSubmit}
          />
          <button
            onClick={() => setNavOpen(true)}
            className="rounded-md border border-brand-gray px-2.5 py-1.5 text-xs font-semibold lg:hidden"
          >
            {answeredIndices.size}/{attempt.questions.length}
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl gap-8 px-4 py-8">
        {/* Question */}
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>
              Question {current + 1} of {attempt.questions.length}
            </span>
            <button onClick={() => toggleMark(current)} className="font-semibold text-brand-gold">
              {marked.has(current) ? "★ Marked for review" : "☆ Mark for review"}
            </button>
          </div>
          <div className="mb-4 h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-1.5 rounded-full bg-brand-teal transition-all"
              style={{ width: `${((current + 1) / attempt.questions.length) * 100}%` }}
            />
          </div>

          <div className="rounded-xl border border-brand-gray p-5">
            <p className="text-base font-medium text-brand-ink">{question.text}</p>
            <div className="mt-4 space-y-2.5">
              {question.options.map((opt) => (
                <div
                  key={opt.key}
                  role="radio"
                  aria-checked={answers[question.id] === opt.key}
                  tabIndex={0}
                  onClick={() => selectAnswer(question.id, opt.key)}
                  onKeyDown={(e) => e.key === "Enter" && selectAnswer(question.id, opt.key)}
                  className="option-row"
                  data-selected={answers[question.id] === opt.key}
                >
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-brand-gray text-xs font-semibold">
                    {opt.key}
                  </span>
                  <span className="text-sm text-gray-800">{opt.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
            >
              ← Previous
            </Button>
            {current < attempt.questions.length - 1 ? (
              <Button onClick={() => setCurrent((c) => c + 1)}>Next →</Button>
            ) : (
              <Button onClick={() => setConfirmSubmit(true)}>Review &amp; Submit</Button>
            )}
          </div>
        </div>

        {/* Desktop nav panel */}
        <div className="hidden w-56 flex-shrink-0 lg:block">
          <div className="sticky top-20 rounded-xl border border-brand-gray p-4">
            <NavigationGrid
              total={attempt.questions.length}
              currentIndex={current}
              answeredIndices={answeredIndices}
              markedIndices={marked}
              onJump={setCurrent}
            />
            <button
              onClick={() => setConfirmSubmit(true)}
              className="mt-4 w-full rounded-lg bg-brand-teal py-2.5 text-sm font-semibold text-white hover:bg-brand-tealDeep"
            >
              Submit Examination
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav sheet */}
      {navOpen && (
        <div className="fixed inset-0 z-20 flex justify-end bg-black/30 lg:hidden" onClick={() => setNavOpen(false)}>
          <div className="h-full w-72 overflow-y-auto bg-white dark:bg-brand-surface p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display font-semibold text-brand-ink">Questions</span>
              <button onClick={() => setNavOpen(false)} aria-label="Close navigation" className="text-gray-500">
                ✕
              </button>
            </div>
            <NavigationGrid
              total={attempt.questions.length}
              currentIndex={current}
              answeredIndices={answeredIndices}
              markedIndices={marked}
              onJump={(i) => {
                setCurrent(i);
                setNavOpen(false);
              }}
            />
            <button
              onClick={() => {
                setNavOpen(false);
                setConfirmSubmit(true);
              }}
              className="mt-4 w-full rounded-lg bg-brand-teal py-2.5 text-sm font-semibold text-white"
            >
              Submit Examination
            </button>
          </div>
        </div>
      )}

      {/* Submit confirmation (§39) — same reasoning as the LMS
          take-exam page's identical modal: kept as its own custom
          structure rather than the shared ConfirmModal, since it needs
          to show live answered/unanswered counts that ConfirmModal's
          plain-text description prop isn't built to lay out. Restyled
          to match, structure and every submit-safety guarantee below
          it untouched. */}
      {confirmSubmit && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-brand-surface p-6 animate-[modal-in_0.15s_ease-out]">
            <p className="font-display font-semibold text-brand-ink">Are you sure you want to submit your examination?</p>
            <div className="mt-3 flex justify-between text-sm text-gray-600">
              <span>Answered: {answeredIndices.size}</span>
              <span>Unanswered: {unansweredCount}</span>
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" onClick={() => setConfirmSubmit(false)} className="flex-1">
                Continue Exam
              </Button>
              <Button onClick={doSubmit} loading={submitting} className="flex-1">
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
