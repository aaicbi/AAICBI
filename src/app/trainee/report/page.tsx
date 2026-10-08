import Breadcrumbs from "@/components/ui/Breadcrumbs";
import TraineeOrgReport from "@/components/ecosystem/TraineeOrgReport";

export const metadata = { title: "Report a Concern" };

export default function TraineeReportPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/trainee/dashboard" }, { label: "Report a Concern" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Report a concern</h1>
      <p className="mt-1 text-sm text-gray-600">If a training organization harmed or mistreated you, tell the Super Admin here. Only the Super Admin sees your report; the organization is never told who sent it.</p>
      <div className="mt-6"><TraineeOrgReport /></div>
    </main>
  );
}
