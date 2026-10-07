"use client";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import DataTable, { type Column } from "@/components/ui/DataTable";

export interface CourseProgressRow {
  id: string;
  title: string;
  published: boolean;
  enrolled: number;
  completed: number;
}
export interface RecentTraineeRow {
  id: string;
  name: string;
  course: string;
  status: "completed" | "ended" | "progress";
  enrolledAt: string;
}
export interface CohortRow {
  id: string;
  name: string;
  course: string;
  startDate: string | null;
  endDate: string | null;
  members: number;
}

const rate = (r: CourseProgressRow) => (r.enrolled ? Math.round((r.completed / r.enrolled) * 100) : null);
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "—");

const COURSE_COLUMNS: Column<CourseProgressRow>[] = [
  {
    key: "course",
    header: "Course",
    sortValue: (r) => r.title,
    render: (r) => (
      <>
        <Link href={`/admin/courses/${r.id}`} className="font-semibold text-brand-ink hover:text-brand-teal">
          {r.title}
        </Link>
        {!r.published && (
          <span className="ml-2">
            <Badge variant="neutral">Draft</Badge>
          </span>
        )}
      </>
    ),
  },
  { key: "enrolled", header: "Enrolled", align: "right", sortValue: (r) => r.enrolled, render: (r) => r.enrolled },
  { key: "completed", header: "Completed", align: "right", sortValue: (r) => r.completed, render: (r) => r.completed },
  { key: "rate", header: "Rate", align: "right", sortValue: rate, render: (r) => (rate(r) === null ? "None yet" : `${rate(r)}%`) },
];

export function CourseProgressTable({ rows }: { rows: CourseProgressRow[] }) {
  return <DataTable caption="Progress by course" rows={rows} rowKey={(r) => r.id} columns={COURSE_COLUMNS} />;
}

const STATUS = {
  completed: <Badge variant="success">Completed</Badge>,
  ended: <Badge variant="neutral">Access ended</Badge>,
  progress: <Badge variant="warning">In progress</Badge>,
} as const;

const TRAINEE_COLUMNS: Column<RecentTraineeRow>[] = [
  { key: "name", header: "Trainee", sortValue: (r) => r.name, render: (r) => <span className="font-semibold text-brand-ink">{r.name}</span> },
  { key: "course", header: "Course", sortValue: (r) => r.course, render: (r) => r.course },
  { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => STATUS[r.status] },
  { key: "enrolled", header: "Enrolled", align: "right", sortValue: (r) => new Date(r.enrolledAt).getTime(), render: (r) => day(r.enrolledAt) },
];

export function RecentTraineesTable({ rows }: { rows: RecentTraineeRow[] }) {
  return (
    <DataTable
      caption="Recent trainees"
      rows={rows}
      rowKey={(r) => r.id}
      columns={TRAINEE_COLUMNS}
      searchLabel="Search trainees or courses"
      searchText={(r) => `${r.name} ${r.course}`}
      pageSize={10}
    />
  );
}

const COHORT_COLUMNS: Column<CohortRow>[] = [
  {
    key: "cohort",
    header: "Cohort",
    sortValue: (r) => r.name,
    render: (r) => (
      <Link href={`/admin/cohorts/${r.id}`} className="font-semibold text-brand-ink hover:text-brand-teal">
        {r.name}
      </Link>
    ),
  },
  { key: "course", header: "Course", sortValue: (r) => r.course, render: (r) => r.course },
  { key: "starts", header: "Starts", sortValue: (r) => (r.startDate ? new Date(r.startDate).getTime() : null), render: (r) => day(r.startDate) },
  { key: "ends", header: "Ends", sortValue: (r) => (r.endDate ? new Date(r.endDate).getTime() : null), render: (r) => day(r.endDate) },
  { key: "members", header: "Trainees", align: "right", sortValue: (r) => r.members, render: (r) => r.members },
];

export function CohortsTable({ rows }: { rows: CohortRow[] }) {
  return <DataTable caption="Cohorts" rows={rows} rowKey={(r) => r.id} columns={COHORT_COLUMNS} />;
}
