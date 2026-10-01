"use client";
import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { ExamOverviewStatus } from "@/lib/trainee/examinationsOverview";

interface Row {
  examId: string;
  title: string;
  kind: "MODULE_ASSESSMENT" | "COURSE_EXAMINATION";
  courseTitle: string;
  moduleTitle: string | null;
  totalQuestions: number;
  durationMinutes: number;
  passMarkPercent: number;
  maxAttempts: number | null;
  attemptsUsed: number;
  bestPercentage: number | null;
  passed: boolean;
  status: ExamOverviewStatus;
  cooldownEndsAt: Date | null;
  actionHref: string;
}

const STATUS_VARIANT: Record<ExamOverviewStatus, "success" | "warning" | "danger" | "neutral" | "gold"> = {
  LOCKED: "neutral",
  AVAILABLE: "neutral",
  IN_PROGRESS: "warning",
  COOLDOWN: "warning",
  PASSED: "success",
  RETAKE_AVAILABLE: "warning",
  ATTEMPTS_EXHAUSTED: "danger",
};

/**
 * Dashboard/Examination redesign — one row of the Examinations table.
 * A client component only because "View Result" needs local
 * expand/collapse state; every other status renders a plain link
 * button to the exam's existing, unmodified intro page (see trim #1
 * in the redesign plan for why "View Result" stays summary-level
 * rather than re-fetching full per-question review here).
 */
export default function ExaminationRow({ row, statusLabel }: { row: Row; statusLabel: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="border-b border-gray-100 align-top">
        <td className="py-2.5 pr-4 font-medium text-brand-ink">{row.title}</td>
        <td className="py-2.5 pr-4 text-gray-600">
          {row.courseTitle}
          {row.moduleTitle && <span className="block text-xs text-gray-400">{row.moduleTitle}</span>}
        </td>
        <td className="py-2.5 pr-4 text-gray-600">
          {row.kind === "COURSE_EXAMINATION" ? "Course Examination" : "Module Assessment"}
        </td>
        <td className="py-2.5 pr-4 text-right text-gray-600">{row.totalQuestions}</td>
        <td className="py-2.5 pr-4 text-right text-gray-600">{row.durationMinutes} min</td>
        <td className="py-2.5 pr-4 text-right text-gray-600">
          {row.attemptsUsed} of {row.maxAttempts ?? "∞"}
        </td>
        <td className="py-2.5 pr-4 text-right text-gray-600">{row.passMarkPercent}%</td>
        <td className="py-2.5 pr-4">
          <Badge variant={STATUS_VARIANT[row.status]}>{statusLabel}</Badge>
        </td>
        <td className="py-2.5 text-right">
          {row.status === "AVAILABLE" && (
            <Button href={row.actionHref} size="sm">
              Start
            </Button>
          )}
          {row.status === "IN_PROGRESS" && (
            <Button href={row.actionHref} size="sm">
              Continue
            </Button>
          )}
          {row.status === "RETAKE_AVAILABLE" && (
            <Button href={row.actionHref} size="sm" variant="secondary">
              Retake
            </Button>
          )}
          {row.status === "PASSED" && (
            <Button onClick={() => setExpanded((v) => !v)} size="sm" variant="secondary">
              {expanded ? "Hide Result" : "View Result"}
            </Button>
          )}
          {row.status === "LOCKED" && <span className="text-xs text-gray-400">Complete the previous module first</span>}
          {row.status === "COOLDOWN" && (
            <span className="text-xs text-gray-400">
              Retake available {row.cooldownEndsAt ? new Date(row.cooldownEndsAt).toLocaleString() : ""}
            </span>
          )}
          {row.status === "ATTEMPTS_EXHAUSTED" && <span className="text-xs text-gray-400">No attempts remaining</span>}
        </td>
      </tr>
      {expanded && row.status === "PASSED" && (
        <tr className="border-b border-gray-100 bg-brand-mint/20">
          <td colSpan={9} className="py-3 px-4 text-sm text-brand-ink">
            Best score: <span className="font-semibold">{Math.round(row.bestPercentage ?? 0)}%</span> ·{" "}
            <span className="font-semibold text-brand-tealDeep">Passed</span> · {row.attemptsUsed} of{" "}
            {row.maxAttempts ?? "∞"} attempts used
          </td>
        </tr>
      )}
    </>
  );
}
