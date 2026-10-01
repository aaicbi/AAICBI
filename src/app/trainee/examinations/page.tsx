import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTraineeExaminationOverview, type ExamOverviewStatus } from "@/lib/trainee/examinationsOverview";
import { TRAINEE_NAV } from "@/lib/trainee/nav";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import { ClipboardCheck } from "lucide-react";
import ExaminationRow from "@/components/trainee/ExaminationRow";

const STATUS_LABEL: Record<ExamOverviewStatus, string> = {
  LOCKED: "Locked",
  AVAILABLE: "Available",
  IN_PROGRESS: "In Progress",
  COOLDOWN: "Cooldown",
  PASSED: "Passed",
  RETAKE_AVAILABLE: "Retake Available",
  ATTEMPTS_EXHAUSTED: "Attempts Exhausted",
};

/**
 * Dashboard/Examination redesign — one table view of every examination
 * a trainee has (module assessments + each enrolled course's own
 * Course Examination), previously only visible piecemeal inside each
 * course's own accordion. Entirely a presentation layer over
 * getTraineeExaminationOverview (src/lib/trainee/examinationsOverview.ts)
 * — a read-only aggregation of the existing exam engine's own data, no
 * new business logic. Every action button links to the exact same,
 * unmodified intro page the course accordion already links to.
 */
export default async function TraineeExaminationsPage() {
  const session = await getSession();
  if (!session || session.role !== "TRAINEE") redirect("/trainee/login");

  const rows = await getTraineeExaminationOverview(session.userId);

  return (
    <>
      <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-ink">
          <Icon icon={ClipboardCheck} size="lg" /> Examinations
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Every module assessment and course examination across the courses you have access to.
        </p>

        {rows.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No examinations yet"
              description="Enroll in a course to see its module assessments and course examination here."
              action={
                <Button href="/trainee/courses" size="md">
                  Browse Courses
                </Button>
              }
            />
          </div>
        ) : (
          <Card className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-gray text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-2 pr-4">Examination</th>
                    <th className="pb-2 pr-4">Course / Module</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4 text-right">Questions</th>
                    <th className="pb-2 pr-4 text-right">Duration</th>
                    <th className="pb-2 pr-4 text-right">Attempts</th>
                    <th className="pb-2 pr-4 text-right">Pass Mark</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <ExaminationRow key={row.examId} row={row} statusLabel={STATUS_LABEL[row.status]} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </>
  );
}
