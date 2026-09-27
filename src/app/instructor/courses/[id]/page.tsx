"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/instructor/LogoutButton";
import BackLink from "@/components/ui/BackLink";
import Icon from "@/components/ui/Icon";
import { LineChart as GaugeIcon } from "lucide-react";
import PerformanceDashboard from "@/components/admin/PerformanceDashboard";

const NAV = [
  { label: "Dashboard", href: "/instructor/dashboard" },
  { label: "My Courses", href: "/instructor/courses" },
  { label: "Teaching Materials", href: "/instructor/materials" },
  { label: "My Payments", href: "/instructor/payments" },
  { label: "Agreement", href: "/instructor/agreement" },
];

/**
 * /instructor/courses/[id] — reuses the exact same PerformanceDashboard
 * component the admin performance page renders. Its own underlying
 * routes (GET /api/courses/[id]/performance, .../modules,
 * GET /api/admin/settings) already allow INSTRUCTOR, and it already
 * hides the one SUPER_ADMIN-only action (messaging suspension) behind
 * its own `isSuperAdmin` check — nothing instructor-specific to build.
 */
export default function InstructorCoursePerformancePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [gateChecked, setGateChecked] = useState(false);

  useEffect(() => {
    fetch("/api/instructor/agreement")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (data?.status !== "ACCEPTED") router.replace("/instructor/dashboard");
        else setGateChecked(true);
      })
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  if (!gateChecked) return null;

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <BackLink href="/instructor/courses" className="text-sm text-brand-teal hover:underline">
          Back to My Courses
        </BackLink>
        <div className="mt-2">
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-ink">
            <Icon icon={GaugeIcon} size="lg" /> Student Performance
          </h1>
          <p className="mt-1 text-sm text-gray-500">Progress, assessment performance, and certification for your students in this course.</p>
        </div>

        <PerformanceDashboard courseId={params.id} />
      </main>
    </>
  );
}
