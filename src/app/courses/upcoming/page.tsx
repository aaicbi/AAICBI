"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import BackLink from "@/components/ui/BackLink";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import UpcomingCourseCard, { type UpcomingCourseRow } from "@/components/courses/UpcomingCourseCard";

const UPCOMING_PHASES = new Set(["COMING_SOON", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"]);

/**
 * /courses/upcoming — the dedicated "every coming-soon course, in one
 * place" page the catalogue page's carousel links out to. Fed by the
 * same anonymous GET /api/courses/public the catalogue page already
 * uses (filtered client-side, same as that page's own carousel), so
 * there's no second API route to keep in sync.
 */
export default function UpcomingCoursesPage() {
  const [courses, setCourses] = useState<UpcomingCourseRow[] | null>(null);

  useEffect(() => {
    fetch("/api/courses/public")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  const upcomingCourses = (courses ?? [])
    .filter((c) => c.lifecyclePhase && UPCOMING_PHASES.has(c.lifecyclePhase))
    .sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Trainee Login", href: "/trainee/login" },
          { label: "Employer Login", href: "/employer/login" },
          { label: "Staff Login", href: "/admin/login" },
        ]}
      />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <BackLink href="/courses">Back to Courses</BackLink>
        <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Coming Soon Courses</h1>
        <p className="mt-1 text-sm text-gray-500">Every upcoming course, in one place — register as soon as spots open.</p>

        {courses === null && (
          <div className="mt-8">
            <SkeletonList rows={3} />
          </div>
        )}
        {courses !== null && upcomingCourses.length === 0 && (
          <div className="mt-8">
            <EmptyState title="No upcoming courses at the moment" description="Check back soon for new course announcements." />
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {upcomingCourses.map((course) => (
            <UpcomingCourseCard key={course.id} course={course} />
          ))}
        </div>
      </main>
    </>
  );
}
