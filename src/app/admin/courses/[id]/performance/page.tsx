"use client";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Icon from "@/components/ui/Icon";
import { LineChart as GaugeIcon } from "lucide-react";
import PerformanceDashboard from "@/components/admin/PerformanceDashboard";
import { ADMIN_NAV } from "@/lib/admin/nav";

export default function CoursePerformancePage({ params }: { params: { id: string } }) {
  return (
    <>
      <SiteHeader nav={ADMIN_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Breadcrumbs items={[{ label: "Courses", href: "/admin/courses" }, { label: "Course", href: `/admin/courses/${params.id}` }, { label: "Performance" }]} />
        <div className="mt-2">
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-ink">
            <Icon icon={GaugeIcon} size="lg" /> Trainee Performance
          </h1>
          <p className="mt-1 text-sm text-gray-500">Course progress, assessment performance, and certification — grounded only in real, recorded data.</p>
        </div>

        <PerformanceDashboard courseId={params.id} />
      </main>
    </>
  );
}
