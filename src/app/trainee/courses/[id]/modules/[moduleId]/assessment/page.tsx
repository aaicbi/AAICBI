"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface AssessmentMeta {
  title: string;
  instructions: string | null;
  durationMinutes: number;
  passMarkPercent: number;
  maxAttempts: number | null;
  totalQuestions: number;
}
interface AttemptHistory {
  maxAttempts: number | null;
  attempts: { attemptNumber: number; status: string; percentage: number | null; passed: boolean | null }[];
}

/**
 * The M11 replacement for /exam/[code] + /exam/[code]/instructions
 * combined into one screen — a trainee arrives here from a "Take
 * Assessment" button inside their course (see the course view page),
 * never by typing a code, so there's no separate "enter code" step to
 * reproduce.
 */
export default function ModuleAssessmentPage({ params }: { params: { id: string; moduleId: string } }) {
  const [meta, setMeta] = useState<AssessmentMeta | null>(null);
  const [history, setHistory] = useState<AttemptHistory | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch(`/api/modules/${params.moduleId}/assessment`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(`/api/modules/${params.moduleId}/attempts`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([metaData, historyData]) => {
        setMeta(metaData);
        setHistory(historyData);
      })
      .catch(() => setNotFound(true));
  }, [params.moduleId]);

  async function handleStart() {
    setStarting(true);
    setError(null);
    // This request is the moment the server clock starts (§4, §7) —
    // the instructions/checkbox step above never touches the timer.
    const res = await fetch(`/api/modules/${params.moduleId}/attempts`, { method: "POST" });
    setStarting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not start the assessment. Please try again.");
      return;
    }
    const data = await res.json();
    sessionStorage.setItem(`lms_attempt_${params.moduleId}`, JSON.stringify(data));
    sessionStorage.setItem(`lms_attempt_start_${params.moduleId}`, String(Date.now()));
    router.push(`/trainee/courses/${params.id}/modules/${params.moduleId}/assessment/take`);
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
          This module doesn&apos;t have an assessment available yet.
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

  const attemptsUsed = history?.attempts.length ?? 0;
  const attemptsExhausted = meta.maxAttempts !== null && attemptsUsed >= meta.maxAttempts;
  const bestPassed = history?.attempts.some((a) => a.passed) ?? false;

  return (
    <>
      <SiteHeader nav={nav} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <a href={`/trainee/courses/${params.id}`} className="text-sm text-brand-teal hover:underline">
          ← Back to course
        </a>
        <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">{meta.title}</h1>

        {history && history.attempts.length > 0 && (
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
The assessment has ${meta.totalQuestions} question${meta.totalQuestions === 1 ? "" : "s"}.
You have ${meta.durationMinutes} minutes.
The pass mark is ${meta.passMarkPercent}%.
Once the time expires, the assessment will be submitted automatically.
Do not refresh or close the browser during the assessment.`}
        </Card>

        {attemptsExhausted ? (
          <div className="mt-5 rounded-lg border border-brand-roseLight bg-brand-roseLight/40 p-4 text-sm text-brand-rose">
            You have used all {meta.maxAttempts} of your allowed attempts for this assessment.
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

            <Button onClick={handleStart} disabled={!confirmed} loading={starting} size="lg" className="mt-5 w-full">
              {starting ? "Starting..." : "Start Assessment"}
            </Button>
          </>
        )}
      </main>
    </>
  );
}
