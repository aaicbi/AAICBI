"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface ExamMeta {
  id: string;
  title: string;
  instructions: string | null;
  durationMinutes: number;
  passMarkPercent: number;
  maxAttempts: number | null;
  totalQuestions: number;
  attempts: { attemptNumber: number; status: string; percentage: number | null; passed: boolean | null }[];
  cooldownEndsAt: string | null;
}

/**
 * The course-scoped twin of the module assessment intro page — same
 * shape, same "arrive via a button inside the course, never a typed
 * code" reasoning, adapted for the one thing a module assessment
 * doesn't have: a retake cooldown, already computed server-side by
 * GET /api/courses/[id]/examination and shown here rather than
 * silently letting a cooled-down retry fail only once attempted.
 */
export default function CourseExaminationIntroPage({ params }: { params: { id: string } }) {
  const [meta, setMeta] = useState<ExamMeta | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/courses/${params.id}/examination`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setMeta)
      .catch(() => setNotFound(true));
  }, [params.id]);

  async function handleStart() {
    setStarting(true);
    setError(null);
    const res = await fetch(`/api/courses/${params.id}/examination/attempts`, { method: "POST" });
    setStarting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not start the examination. Please try again.");
      return;
    }
    const data = await res.json();
    sessionStorage.setItem(`lms_course_exam_${params.id}`, JSON.stringify(data));
    sessionStorage.setItem(`lms_course_exam_start_${params.id}`, String(Date.now()));
    router.push(`/trainee/courses/${params.id}/examination/take`);
  }

  const nav = [
    { label: "Dashboard", href: "/trainee/dashboard" },
    { label: "Courses", href: "/trainee/courses" },
    { label: "Settings", href: "/trainee/settings" },
  ];

  if (notFound) {
    return (
      <>
        <SiteHeader nav={nav} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10 text-center text-gray-600">
          This course doesn&apos;t have a course examination available yet.
        </main>
      </>
    );
  }
  if (!meta) {
    return (
      <>
        <SiteHeader nav={nav} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <div className="h-4 w-32 animate-pulse rounded-full bg-brand-gray/60" />
          <div className="mt-4 h-8 w-64 animate-pulse rounded-full bg-brand-gray/60" />
          <div className="mt-6 h-40 animate-pulse rounded-lg bg-brand-gray/40" />
        </main>
      </>
    );
  }

  const attemptsUsed = meta.attempts.length;
  const attemptsExhausted = meta.maxAttempts !== null && attemptsUsed >= meta.maxAttempts;
  const bestPassed = meta.attempts.some((a) => a.passed);
  const cooldownActive = meta.cooldownEndsAt !== null && new Date(meta.cooldownEndsAt) > new Date();
  const blocked = attemptsExhausted || cooldownActive;

  return (
    <>
      <SiteHeader nav={nav} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <a href={`/trainee/courses/${params.id}`} className="text-sm text-brand-teal hover:underline">
          ← Back to course
        </a>
        <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">{meta.title}</h1>

        {meta.attempts.length > 0 && (
          <Card variant="highlighted" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-700">
            {bestPassed ? (
              <Badge variant="success">✓ Already passed</Badge>
            ) : (
              <Badge variant="neutral">Attempted before</Badge>
            )}
            {meta.maxAttempts !== null && (
              <span className="text-xs text-gray-600">
                {attemptsUsed} of {meta.maxAttempts} attempt{meta.maxAttempts === 1 ? "" : "s"} used
              </span>
            )}
          </Card>
        )}

        <Card className="mt-4 whitespace-pre-line bg-brand-mint/40 text-sm leading-relaxed text-gray-700">
          {meta.instructions ||
            `Read each question carefully. Select only one answer unless otherwise stated.
The examination has ${meta.totalQuestions} question${meta.totalQuestions === 1 ? "" : "s"}.
You have ${meta.durationMinutes} minutes.
The pass mark is ${meta.passMarkPercent}%.
Once the time expires, the examination will be submitted automatically.
Do not refresh or close the browser during the examination.`}
        </Card>

        {attemptsExhausted ? (
          <div className="mt-5 rounded-lg border border-brand-roseLight bg-brand-roseLight/40 p-4 text-sm text-brand-rose">
            You have used all {meta.maxAttempts} of your allowed attempts for this examination.
          </div>
        ) : cooldownActive ? (
          <div className="mt-5 rounded-lg border border-brand-roseLight bg-brand-roseLight/40 p-4 text-sm text-brand-rose">
            You need to wait before retaking this examination — available again{" "}
            {new Date(meta.cooldownEndsAt!).toLocaleString()}.
          </div>
        ) : (
          <>
            <label className="mt-5 flex items-center gap-2 text-sm text-brand-ink">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="h-4 w-4 accent-brand-teal"
              />
              I have read the instructions
            </label>

            {error && <p className="mt-3 text-sm text-brand-rose">{error}</p>}

            <Button onClick={handleStart} disabled={!confirmed || blocked} loading={starting} size="lg" className="mt-5 w-full">
              {starting ? "Starting..." : "Start Examination"}
            </Button>
          </>
        )}
      </main>
    </>
  );
}
