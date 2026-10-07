import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTraineeExaminationOverview } from "@/lib/trainee/examinationsOverview";
import { TRAINEE_NAV } from "@/lib/trainee/nav";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import { ClipboardCheck } from "lucide-react";
import ExaminationsTable from "@/components/trainee/ExaminationsTable";

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
            <ExaminationsTable rows={rows} />
          </Card>
        )}
      </main>
    </>
  );
}
