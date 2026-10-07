import Breadcrumbs from "@/components/ui/Breadcrumbs";
import TraineeConsentList from "@/components/ecosystem/TraineeConsentList";

export const metadata = { title: "Video requests" };

export default function TraineeEducationConsentPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/trainee/dashboard" }, { label: "Video requests" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Video requests</h1>
      <p className="mt-1 text-sm text-gray-600">Training organizations ask your permission before showing a video that features you. You can change your mind at any time.</p>
      <div className="mt-6"><TraineeConsentList /></div>
    </main>
  );
}
