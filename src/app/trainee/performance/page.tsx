import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTraineeReport } from "@/lib/reports/performance";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import TraineeReportView from "@/components/reports/TraineeReportView";

export const metadata = { title: "My performance report" };
export const dynamic = "force-dynamic";

/** A trainee's own full report. Only ever their own data. */
export default async function TraineePerformancePage() {
  const session = await getSession();
  if (!session || session.role !== "TRAINEE") redirect("/login");
  const report = await getTraineeReport(session.userId, { scopeNote: "Everything you have done on AAICBI." });
  if (!report) redirect("/login");
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/trainee/dashboard" }, { label: "My performance report" }]} />
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="font-display text-2xl font-semibold text-brand-ink">My performance report</h1><p className="text-sm text-gray-600">Your progress, every assessment try, your game play and how you use the platform.</p></div>
        <Button href="/api/trainee/my-activity/report.pdf" variant="secondary" size="sm">Download PDF</Button>
      </div>
      <div className="mt-5"><TraineeReportView r={report} /></div>
    </main>
  );
}
