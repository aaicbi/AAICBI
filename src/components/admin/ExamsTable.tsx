"use client";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import DataTable, { type Column } from "@/components/ui/DataTable";

export interface ExamRow {
  id: string;
  title: string;
  code: string;
  questions: number;
  attempts: number;
  published: boolean;
}

const ACTION = "rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold hover:border-brand-teal";

const COLUMNS: Column<ExamRow>[] = [
  { key: "title", header: "Examination", render: (e) => <span className="font-medium text-brand-ink">{e.title}</span>, sortValue: (e) => e.title },
  { key: "code", header: "Code", className: "font-mono text-xs text-gray-600", render: (e) => e.code, sortValue: (e) => e.code },
  { key: "questions", header: "Questions", align: "right", render: (e) => e.questions, sortValue: (e) => e.questions },
  { key: "attempts", header: "Attempts", align: "right", render: (e) => e.attempts, sortValue: (e) => e.attempts },
  {
    key: "status",
    header: "Status",
    render: (e) => <Badge variant={e.published ? "success" : "neutral"}>{e.published ? "Published" : "Draft"}</Badge>,
    sortValue: (e) => (e.published ? 1 : 0),
  },
  {
    key: "actions",
    header: "",
    align: "right",
    render: (e) => (
      <div className="flex justify-end gap-2">
        <Link href={`/admin/exams/${e.id}/import`} className={ACTION}>
          Questions
        </Link>
        <Link href={`/admin/exams/${e.id}/results`} className={ACTION}>
          Results
        </Link>
      </div>
    ),
  },
];

export default function ExamsTable({ exams }: { exams: ExamRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={exams}
      rowKey={(e) => e.id}
      caption="Your examinations"
      searchText={(e) => `${e.title} ${e.code}`}
      searchLabel="Search examinations"
    />
  );
}
