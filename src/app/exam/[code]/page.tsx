"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface ExamMeta {
  code: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  totalQuestions: number;
}

// M9 change from the CBT scaffold: this page used to collect name/email/
// student ID/phone/cohort from an anonymous test-taker before every
// attempt. A trainee is now authenticated before they ever reach this
// page (see middleware.ts), so that information already exists on their
// account — asking for it again would be redundant and confusing. This
// page's only job now is showing what they're about to start and
// getting a confirmation click; M11 replaces the exam-code URL itself
// with navigation from inside a course module.
export default function ExamEntryPage({ params }: { params: { code: string } }) {
  const [exam, setExam] = useState<ExamMeta | null>(null);
  const [notFound, setNotFound] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/exams/by-code/${params.code}`)
      .then(async (r) => {
        if (!r.ok) {
          setNotFound(true);
          return;
        }
        setExam(await r.json());
      })
      .catch(() => setNotFound(true));
  }, [params.code]);

  function handleContinue() {
    sessionStorage.setItem(`cbt_candidate_${params.code}`, "confirmed");
    router.push(`/exam/${params.code}/instructions`);
  }

  if (notFound) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col items-center justify-center px-6 text-center">
          <p className="text-gray-700">
            Examination not found, or it is not currently open. Please check your code with your instructor.
          </p>
        </main>
      </>
    );
  }
  if (!exam) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-sm px-6 py-10">
          <div className="h-4 w-24 animate-pulse rounded-full bg-brand-gray/60" />
          <div className="mt-2 h-8 w-56 animate-pulse rounded-full bg-brand-gray/60" />
          <div className="mt-6 h-24 animate-pulse rounded-lg bg-brand-gray/40" />
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col justify-center px-6 py-10">
        <span className="text-xs font-semibold uppercase tracking-widest text-brand-teal">Examination</span>
        <h1 className="mt-1 font-display text-2xl font-semibold text-brand-ink">{exam.title}</h1>
        {exam.description && <p className="mt-1 text-sm text-gray-600">{exam.description}</p>}

        <Card className="mt-4">
          <div className="flex gap-4 text-xs text-gray-500">
            <span>{exam.totalQuestions} questions</span>
            <span>{exam.durationMinutes} minutes</span>
          </div>
          <Button onClick={handleContinue} className="mt-4 w-full">
            Continue
          </Button>
        </Card>
      </main>
    </>
  );
}
