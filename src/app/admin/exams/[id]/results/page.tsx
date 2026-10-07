"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DataTable from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { Clock, Award } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { ADMIN_NAV } from "@/lib/admin/nav";

import { Input } from "@/components/ui/Field";
interface PerformanceSummaryDto {
  strengths: string[];
  weaknesses: string[];
  narrative: string;
}
interface AttemptRow {
  id: string;
  attemptNumber: number;
  score: number | null;
  totalQuestions: number | null;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: string | null;
  traineeId: string;
  trainee: { name: string; email: string };
  performanceSummary: PerformanceSummaryDto | null;
  // Standalone-exam certificates only (see ExamCertificate's own
  // schema comment) — null for every course-examination/module-
  // assessment attempt.
  earnedExamCertificate: { code: string; revokedAt: string | null } | null;
}
interface ResultsResponse {
  summary: {
    totalTrainees: number;
    testsCompleted: number;
    passed: number;
    failed: number;
    averageScore: number;
    highestScore: number;
  };
  attempts: AttemptRow[];
}

export default function ExamResultsPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [search, setSearch] = useState("");
  const [waiving, setWaiving] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const q = new URLSearchParams({ examId: params.id, ...(search ? { q: search } : {}) });
    fetch(`/api/results?${q}`)
      .then((r) => r.json())
      .then(setData);
  }, [params.id, search]);

  async function waiveCooldown(traineeId: string, traineeName: string) {
    setWaiving(traineeId);
    const res = await fetch(`/api/exams/${params.id}/cooldown-override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traineeId }),
    });
    setWaiving(null);
    if (!res.ok) {
      showToast("Couldn't waive the cooldown. Please try again.", "error");
      return;
    }
    showToast(`${traineeName} can retake this exam right away.`, "success");
  }

  const cards: [string, number | string][] = data
    ? [
        ["Total Trainees", data.summary.totalTrainees],
        ["Tests Completed", data.summary.testsCompleted],
        ["Passed", data.summary.passed],
        ["Failed", data.summary.failed],
        ["Average Score", `${data.summary.averageScore}%`],
        ["Highest Score", `${data.summary.highestScore}%`],
      ]
    : [];

  return (
    <>
      <SiteHeader
        nav={ADMIN_NAV}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-brand-ink">Results</h1>
          <a
            href={`/api/results/${params.id}/export`}
            className="rounded-lg border border-brand-gray px-4 py-2 text-sm font-semibold hover:border-brand-teal"
          >
            Export CSV
          </a>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {!data
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-brand-gray/30" />
              ))
            : cards.map(([label, value]) => (
                <Card key={label} variant="highlighted" className="p-4">
                  <div className="font-display text-2xl font-semibold text-brand-teal">{value}</div>
                  <div className="text-xs text-gray-600">{label}</div>
                </Card>
              ))}
        </div>

        <Input label="Search by name or email" hideLabel wrapperClassName="mt-4" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." />

        <div className="mt-4">
          <DataTable
            caption="Submitted attempts for this examination"
            rows={data ? data.attempts : null}
            rowKey={(a) => a.id}
            empty={<p className="py-6 text-center text-gray-600">No submitted attempts yet.</p>}
            columns={[
              {
                key: "trainee",
                header: "Trainee",
                sortValue: (a) => a.trainee.name,
                render: (a) => (
                  <div>
                    <div className="font-medium text-brand-ink">{a.trainee.name}</div>
                    <div className="text-xs font-normal text-gray-600">{a.trainee.email}</div>
                  </div>
                ),
              },
              {
                key: "score",
                header: "Score",
                sortValue: (a) => a.percentage,
                render: (a) => `${a.score}/${a.totalQuestions} (${Math.round(a.percentage ?? 0)}%)`,
              },
              {
                key: "status",
                header: "Status",
                sortValue: (a) => (a.passed ? 1 : 0),
                render: (a) => <Badge variant={a.passed ? "success" : "danger"}>{a.passed ? "PASS" : "FAIL"}</Badge>,
              },
              {
                key: "submitted",
                header: "Submitted",
                className: "text-xs text-gray-600",
                sortValue: (a) => (a.submittedAt ? new Date(a.submittedAt).getTime() : null),
                render: (a) => (a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "—"),
              },
              {
                key: "cooldown",
                header: "",
                render: (a) => (
                  <button
                    onClick={() => waiveCooldown(a.traineeId, a.trainee.name)}
                    disabled={waiving === a.traineeId}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-brand-teal disabled:opacity-50"
                    title="Let this trainee retake the exam right away, bypassing the retake cooldown."
                  >
                    <Icon icon={Clock} size="sm" /> {waiving === a.traineeId ? "Waiving…" : "Waive cooldown"}
                  </button>
                ),
              },
              {
                key: "certificate",
                header: "",
                render: (a) =>
                  a.earnedExamCertificate && !a.earnedExamCertificate.revokedAt ? (
                    <a
                      href={`/certificate/${a.earnedExamCertificate.code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-goldText hover:underline"
                    >
                      <Icon icon={Award} size="sm" /> Certificate Issued
                    </a>
                  ) : null,
              },
            ]}
            expand={{
              // Not every attempt has a summary (best-effort generation,
              // see the schema comment on PerformanceSummary); rows
              // without one simply show no toggle.
              label: (open) => (open ? "Hide analysis" : "AI analysis"),
              render: (a) =>
                a.performanceSummary ? (
                  <div>
                    <p className="text-sm text-gray-700">{a.performanceSummary.narrative}</p>
                    {(a.performanceSummary.strengths.length > 0 || a.performanceSummary.weaknesses.length > 0) && (
                      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {a.performanceSummary.strengths.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-brand-teal">Strong in</p>
                            <p className="text-sm text-gray-800">{a.performanceSummary.strengths.join(", ")}</p>
                          </div>
                        )}
                        {a.performanceSummary.weaknesses.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-brand-goldText">Needs improvement</p>
                            <p className="text-sm text-gray-800">{a.performanceSummary.weaknesses.join(", ")}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null,
            }}
          />
        </div>
      </main>
    </>
  );
}
