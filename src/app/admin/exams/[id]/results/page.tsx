"use client";
import { Fragment, useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { SkeletonTableRows } from "@/components/ui/Skeleton";

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
  trainee: { name: string; email: string };
  performanceSummary: PerformanceSummaryDto | null;
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
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams({ examId: params.id, ...(search ? { q: search } : {}) });
    fetch(`/api/results?${q}`)
      .then((r) => r.json())
      .then(setData);
  }, [params.id, search]);

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
      <SiteHeader />
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

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          aria-label="Search by name or email"
          className="mt-6 w-full rounded-lg border border-brand-gray px-4 py-2.5 outline-none focus:border-brand-teal"
        />

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-brand-gray text-gray-500">
                <th className="py-2">Trainee</th>
                <th>Score</th>
                <th>Status</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <SkeletonTableRows rows={5} cols={5} />
              ) : (
                <>
                  {data.attempts.map((a) => (
                    <Fragment key={a.id}>
                      <tr
                        className={`border-b border-gray-100 ${a.performanceSummary ? "cursor-pointer hover:bg-gray-50" : ""}`}
                        onClick={() => a.performanceSummary && setExpanded(expanded === a.id ? null : a.id)}
                      >
                        <td className="py-2">
                          <div className="font-medium text-brand-ink">{a.trainee.name}</div>
                          <div className="text-xs text-gray-500">{a.trainee.email}</div>
                        </td>
                        <td>
                          {a.score}/{a.totalQuestions} ({Math.round(a.percentage ?? 0)}%)
                        </td>
                        <td>
                          <Badge variant={a.passed ? "success" : "danger"}>{a.passed ? "PASS" : "FAIL"}</Badge>
                        </td>
                        <td className="text-xs text-gray-500">
                          {a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "—"}
                        </td>
                        <td className="text-xs text-brand-teal">
                          {/* M13 — not every attempt has a summary (best-effort
                              generation, see the schema comment on
                              PerformanceSummary); this cell is just silent for
                              those rather than showing a broken/empty link. */}
                          {a.performanceSummary && (expanded === a.id ? "▾ Hide analysis" : "▸ AI analysis")}
                        </td>
                      </tr>
                      {expanded === a.id && a.performanceSummary && (
                        <tr className="border-b border-gray-100 bg-brand-mint/30">
                          <td colSpan={5} className="px-2 py-3">
                            <p className="text-sm text-gray-700">{a.performanceSummary.narrative}</p>
                            {(a.performanceSummary.strengths.length > 0 ||
                              a.performanceSummary.weaknesses.length > 0) && (
                              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {a.performanceSummary.strengths.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-brand-teal">Strong in</p>
                                    <p className="text-sm text-gray-800">{a.performanceSummary.strengths.join(", ")}</p>
                                  </div>
                                )}
                                {a.performanceSummary.weaknesses.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-brand-gold">Needs improvement</p>
                                    <p className="text-sm text-gray-800">
                                      {a.performanceSummary.weaknesses.join(", ")}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {data.attempts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500">
                        No submitted attempts yet.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
