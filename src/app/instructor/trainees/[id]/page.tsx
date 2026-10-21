import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { scopeForTrainee } from "@/lib/reports/access";
import { getTraineeReport } from "@/lib/reports/performance";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/instructor/LogoutButton";
import BackLink from "@/components/ui/BackLink";
import ReportActions from "@/components/reports/ReportActions";
import TraineeReportView from "@/components/reports/TraineeReportView";

export const metadata = { title: "Trainee report" };
export const dynamic = "force-dynamic";

const NAV = [
  { label: "Dashboard", href: "/instructor/dashboard" },
  { label: "My Courses", href: "/instructor/courses" },
  { label: "Trainee Reports", href: "/instructor/trainees" },
  { label: "Teaching Materials", href: "/instructor/materials" },
  { label: "My Payments", href: "/instructor/payments" },
  { label: "Agreement", href: "/instructor/agreement" },
];

export default async function InstructorTraineePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "INSTRUCTOR") redirect("/admin/login");
  const scope = await scopeForTrainee(session, params.id);
  const report = scope ? await getTraineeReport(params.id, scope) : null;
  if (!report) notFound();
  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <BackLink href="/instructor/trainees" className="text-sm text-brand-teal hover:underline">Back to trainee reports</BackLink>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="font-display text-2xl font-semibold text-brand-ink">{report.trainee.name}</h1><p className="text-sm text-gray-600 [overflow-wrap:anywhere]">{report.trainee.email}</p></div>
          <ReportActions traineeId={report.trainee.id} />
        </div>
        <div className="mt-5"><TraineeReportView r={report} /></div>
      </main>
    </>
  );
}
