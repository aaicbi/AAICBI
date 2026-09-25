"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Icon from "@/components/ui/Icon";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import { LineChart as GaugeIcon } from "lucide-react";
import PerformanceDashboard from "@/components/admin/PerformanceDashboard";

interface CourseOption {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
}

const NAV = [
  { label: "Examinations", href: "/admin/dashboard" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Performance", href: "/admin/performance" },
  { label: "Payments", href: "/admin/payments" },
  { label: "My Profile", href: "/admin/profile" },
  { label: "Settings", href: "/admin/settings" },
];

/**
 * The general Trainee Performance dashboard — a course picker on top
 * of the same PerformanceDashboard component the course-scoped page
 * uses (src/app/admin/courses/[id]/performance/page.tsx), so an admin
 * doesn't have to open a specific course first just to check trainee
 * performance. /api/courses already scopes to courses this staff
 * member can see (SUPER_ADMIN: all, ADMIN/INSTRUCTOR: their own) —
 * the exact same ownership rule the performance API itself enforces,
 * so nothing shows up here that would 404 once selected.
 */
export default function GeneralPerformancePage() {
  const [courses, setCourses] = useState<CourseOption[] | null>(null);
  const [courseId, setCourseId] = useState("");

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-ink">
          <Icon icon={GaugeIcon} size="lg" /> Trainee Performance
        </h1>
        <p className="mt-1 text-sm text-gray-500">Select a course to see the performance of every trainee enrolled in it.</p>

        <div className="mt-6">
          {courses === null ? (
            <SkeletonList rows={1} />
          ) : (
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full max-w-md rounded-lg border border-brand-gray px-3 py-2.5 text-sm font-semibold outline-none focus:border-brand-teal"
            >
              <option value="">Select a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} {c.status !== "PUBLISHED" ? `(${c.status[0]}${c.status.slice(1).toLowerCase()})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {courses !== null && courses.length === 0 && (
          <div className="mt-6">
            <EmptyState illustration={<GrowthPathDoodle className="h-full w-full" />} title="No courses yet" description="Create a course first to start tracking trainee performance." />
          </div>
        )}

        {courseId ? (
          <PerformanceDashboard key={courseId} courseId={courseId} />
        ) : (
          courses !== null &&
          courses.length > 0 && (
            <div className="mt-6">
              <EmptyState illustration={<GrowthPathDoodle className="h-full w-full" />} title="Pick a course to get started" description="Its trainee performance data will appear here." />
            </div>
          )
        )}
      </main>
    </>
  );
}
