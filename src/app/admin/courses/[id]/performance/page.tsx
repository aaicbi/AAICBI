"use client";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import BackLink from "@/components/ui/BackLink";
import Icon from "@/components/ui/Icon";
import { LineChart as GaugeIcon } from "lucide-react";
import PerformanceDashboard from "@/components/admin/PerformanceDashboard";

const NAV = [
  { label: "Examinations", href: "/admin/dashboard" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Performance", href: "/admin/performance" },
  { label: "Messages", href: "/admin/messages" },
  { label: "My Profile", href: "/admin/profile" },
  { label: "Settings", href: "/admin/settings" },
];

export default function CoursePerformancePage({ params }: { params: { id: string } }) {
  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <BackLink href={`/admin/courses/${params.id}`} className="text-sm text-brand-teal hover:underline">
          Back to course
        </BackLink>
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
