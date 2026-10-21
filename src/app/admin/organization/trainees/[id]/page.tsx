import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { scopeForTrainee } from "@/lib/reports/access";
import { getTraineeReport } from "@/lib/reports/performance";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import ReportActions from "@/components/reports/ReportActions";
import TraineeReportView from "@/components/reports/TraineeReportView";

export const metadata = { title: "Trainee report" };
export const dynamic = "force-dynamic";

/** One trainee in full: progress, every assessment attempt, game and platform engagement. Only trainees enrolled in the viewer's own courses can be opened. */
export default async function OrganizationTraineePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) redirect("/admin/dashboard");
  const scope = await scopeForTrainee(session, params.id);
  const report = scope ? await getTraineeReport(params.id, scope) : null;
  if (!report) notFound();
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Organization", href: "/admin/organization" }, { label: "Trainees", href: "/admin/organization/trainees" }, { label: report.trainee.name }]} />
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-brand-ink">{report.trainee.name}</h1>
          <p className="text-sm text-gray-600 [overflow-wrap:anywhere]">{report.trainee.email}{report.trainee.phone ? ` · ${report.trainee.phone}` : ""}</p>
        </div>
        <ReportActions traineeId={report.trainee.id} />
      </div>
      <div className="mt-5"><TraineeReportView r={report} /></div>
    </main>
  );
}
