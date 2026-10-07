"use client";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import DataTable, { type Column } from "@/components/ui/DataTable";
import type { ExamOverviewStatus, TraineeExamRow } from "@/lib/trainee/examinationsOverview";

const STATUS_LABEL: Record<ExamOverviewStatus, string> = {
  LOCKED: "Locked",
  AVAILABLE: "Available",
  IN_PROGRESS: "In Progress",
  COOLDOWN: "Cooldown",
  PASSED: "Passed",
  RETAKE_AVAILABLE: "Retake Available",
  ATTEMPTS_EXHAUSTED: "Attempts Exhausted",
};

const STATUS_VARIANT: Record<ExamOverviewStatus, "success" | "warning" | "danger" | "neutral" | "gold"> = {
  LOCKED: "neutral",
  AVAILABLE: "neutral",
  IN_PROGRESS: "warning",
  COOLDOWN: "warning",
  PASSED: "success",
  RETAKE_AVAILABLE: "warning",
  ATTEMPTS_EXHAUSTED: "danger",
};

function attempts(r: TraineeExamRow) {
  return `${r.attemptsUsed} of ${r.maxAttempts ?? "∞"}`;
}

const COLUMNS: Column<TraineeExamRow>[] = [
  { key: "title", header: "Examination", sortValue: (r) => r.title, render: (r) => <span className="font-medium text-brand-ink">{r.title}</span> },
  {
    key: "course",
    header: "Course / Module",
    className: "text-gray-600",
    sortValue: (r) => r.courseTitle,
    render: (r) => (
      <>
        {r.courseTitle}
        {r.moduleTitle && <span className="block text-xs text-gray-600">{r.moduleTitle}</span>}
      </>
    ),
  },
  {
    key: "kind",
    header: "Type",
    className: "text-gray-600",
    sortValue: (r) => r.kind,
    render: (r) => (r.kind === "COURSE_EXAMINATION" ? "Course Examination" : "Module Assessment"),
  },
  { key: "questions", header: "Questions", align: "right", sortValue: (r) => r.totalQuestions, render: (r) => r.totalQuestions },
  { key: "duration", header: "Duration", align: "right", sortValue: (r) => r.durationMinutes, render: (r) => `${r.durationMinutes} min` },
  { key: "attempts", header: "Attempts", align: "right", sortValue: (r) => r.attemptsUsed, render: attempts },
  { key: "pass", header: "Pass Mark", align: "right", sortValue: (r) => r.passMarkPercent, render: (r) => `${r.passMarkPercent}%` },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => STATUS_LABEL[r.status],
    render: (r) => <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
  },
  {
    key: "action",
    header: "",
    align: "right",
    render: (r) => (
      <>
        {r.status === "AVAILABLE" && (
          <Button href={r.actionHref} size="sm">
            Start
          </Button>
        )}
        {r.status === "IN_PROGRESS" && (
          <Button href={r.actionHref} size="sm">
            Continue
          </Button>
        )}
        {r.status === "RETAKE_AVAILABLE" && (
          <Button href={r.actionHref} size="sm" variant="secondary">
            Retake
          </Button>
        )}
        {r.status === "LOCKED" && <span className="text-xs text-gray-600">Complete the previous module first</span>}
        {r.status === "COOLDOWN" && (
          <span className="text-xs text-gray-600">
            Retake available {r.cooldownEndsAt ? new Date(r.cooldownEndsAt).toLocaleString() : ""}
          </span>
        )}
        {r.status === "ATTEMPTS_EXHAUSTED" && <span className="text-xs text-gray-600">No attempts remaining</span>}
      </>
    ),
  },
];

/**
 * The trainee's Examinations table. A passed row can expand to show a
 * one-line result summary; every other status shows the single action
 * that makes sense for it. Built on the shared DataTable, so it also
 * sorts, searches, pages and becomes cards on a phone.
 */
export default function ExaminationsTable({ rows }: { rows: TraineeExamRow[] }) {
  return (
    <DataTable
      caption="Your examinations"
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.examId}
      searchLabel="Search examinations"
      searchText={(r) => `${r.title} ${r.courseTitle} ${r.moduleTitle ?? ""}`}
      expand={{
        label: (open) => (open ? "Hide result" : "View result"),
        render: (r) =>
          r.status === "PASSED" ? (
            <p className="text-sm text-brand-ink">
              Best score: <span className="font-semibold">{Math.round(r.bestPercentage ?? 0)}%</span> ·{" "}
              <span className="font-semibold text-brand-tealDeep">Passed</span> · {attempts(r)} attempts used
            </p>
          ) : null,
      }}
    />
  );
}
