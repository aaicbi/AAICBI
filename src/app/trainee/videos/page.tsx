import Breadcrumbs from "@/components/ui/Breadcrumbs";
import TraineeVideos from "@/components/ecosystem/TraineeVideos";

export const metadata = { title: "My Videos" };

export default function TraineeVideosPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/trainee/dashboard" }, { label: "My Videos" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">My Videos</h1>
      <p className="mt-1 text-sm text-gray-600">Share a YouTube video about what you learned. Your training organization reviews it first.</p>
      <div className="mt-6"><TraineeVideos /></div>
    </main>
  );
}
