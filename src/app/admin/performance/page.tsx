"use client";
import { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import { LineChart as GaugeIcon, BookOpen } from "lucide-react";
import PerformanceDashboard from "@/components/admin/PerformanceDashboard";

interface CourseOption {
  id: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
  category: string | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  durationDisplay: string | null;
  trainingFormat: "SELF_PACED" | "INSTRUCTOR_LED" | "HYBRID" | null;
  instructorNames: string | null;
  flyerUrl: string | null;
  _count: { modules: number };
}

const LEVEL_LABEL: Record<string, string> = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };
const FORMAT_LABEL: Record<string, string> = { SELF_PACED: "Self-paced", INSTRUCTOR_LED: "Instructor-led", HYBRID: "Hybrid" };

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
 * so nothing shows up here that would 404 once selected. It also
 * already returns every scalar Course field (no `select` on that
 * route), so the picture/details summary card below needs no new API
 * work — just the fields already sitting in that same response.
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

  const selectedCourse = useMemo(() => courses?.find((c) => c.id === courseId) ?? null, [courses, courseId]);

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-ink">
          <Icon icon={GaugeIcon} size="lg" /> Trainee Performance
        </h1>
        <p className="mt-1 text-sm text-gray-500">Select a course to see the performance of every trainee enrolled in it.</p>

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="w-full lg:max-w-md">
            {courses === null ? (
              <SkeletonList rows={1} />
            ) : (
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full rounded-lg border border-brand-gray px-3 py-2.5 text-sm font-semibold outline-none focus:border-brand-teal"
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

          {/* Summarized course card — same picture/instructor/details
              language as the public course card (UpcomingCourseCard)
              and the course marketing page, condensed to one row. */}
          {selectedCourse && (
            <Card className="flex w-full items-start gap-3 p-3 lg:flex-1">
              <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-mint to-brand-teal/20">
                {selectedCourse.flyerUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a real, dynamically-uploaded external URL.
                  <img src={selectedCourse.flyerUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Icon icon={BookOpen} size="lg" className="text-brand-teal/40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate font-display font-semibold text-brand-ink">{selectedCourse.title}</p>
                  {selectedCourse.level && <Badge variant="neutral">{LEVEL_LABEL[selectedCourse.level]}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {[
                    selectedCourse.category,
                    selectedCourse.durationDisplay,
                    selectedCourse.trainingFormat ? FORMAT_LABEL[selectedCourse.trainingFormat] : null,
                    `${selectedCourse._count.modules} module${selectedCourse._count.modules === 1 ? "" : "s"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {selectedCourse.instructorNames && (
                  <p className="mt-1 text-xs text-brand-ink">
                    <span className="text-gray-500">Taught by</span> <span className="font-semibold">{selectedCourse.instructorNames}</span>
                  </p>
                )}
              </div>
            </Card>
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
