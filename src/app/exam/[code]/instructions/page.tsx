"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface ExamMeta {
  title: string;
  instructions: string | null;
  durationMinutes: number;
  totalQuestions: number;
}

export default function InstructionsPage({ params }: { params: { code: string } }) {
  const [exam, setExam] = useState<ExamMeta | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const candidateRaw = sessionStorage.getItem(`cbt_candidate_${params.code}`);
    if (!candidateRaw) {
      router.replace(`/exam/${params.code}`);
      return;
    }
    fetch(`/api/exams/by-code/${params.code}`)
      .then((r) => r.json())
      .then(setExam);
  }, [params.code, router]);

  async function handleStart() {
    const candidateRaw = sessionStorage.getItem(`cbt_candidate_${params.code}`);
    if (!candidateRaw) return;

    setStarting(true);
    setError(null);
    // This request is the moment the server clock starts (§4, §7) — the
    // instructions/checkbox step above never touches the timer.
    //
    // Bug found only by actually clicking through this flow (never
    // caught by tsc or the test suite — string literals type-check
    // fine regardless of content, and nothing tests this specific
    // sessionStorage handoff): this used to do
    // `JSON.parse(candidateRaw)` and spread the result into this
    // request body. The M9 comment on POST /api/attempts already
    // explains why — anonymous candidate info collection (name/email/
    // studentId/etc, typed on this exact screen in the original CBT
    // scaffold) was replaced by real trainee accounts, and that
    // route's schema only ever expects `examCode` now. But this page's
    // JSON.parse call on the entry page's plain "confirmed" marker
    // (see exam/[code]/page.tsx) was never updated to match, so it
    // threw on every single attempt to actually start a by-code exam.
    // Removed rather than patched — the spread had nothing left to
    // contribute.
    const res = await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examCode: params.code }),
    });
    setStarting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not start the examination. Please try again.");
      return;
    }
    const data = await res.json();
    sessionStorage.setItem(`cbt_attempt_${params.code}`, JSON.stringify(data));
    sessionStorage.setItem(`cbt_attempt_start_${params.code}`, String(Date.now()));
    router.push(`/exam/${params.code}/take`);
  }

  if (!exam) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <div className="h-8 w-72 animate-pulse rounded-full bg-brand-gray/60" />
          <div className="mt-4 h-40 animate-pulse rounded-lg bg-brand-gray/40" />
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Examination Instructions</h1>
        <Card className="mt-4 whitespace-pre-line bg-brand-mint/40 text-sm leading-relaxed text-gray-700">
          {exam.instructions ||
            `Read each question carefully. Select only one answer unless otherwise stated.
The examination has ${exam.totalQuestions} questions.
You have ${exam.durationMinutes} minutes.
Once the time expires, the examination will be submitted automatically.
Do not refresh or close the browser during the examination.
Your score will be calculated automatically.`}
        </Card>

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
          {starting ? "Starting..." : "Start Test"}
        </Button>
      </main>
    </>
  );
}
