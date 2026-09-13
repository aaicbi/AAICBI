"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";

interface PublicCourseRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  isFree: boolean;
  priceKobo: number | null;
  flyerUrl: string | null;
  moduleCount: number;
}

const LEVEL_LABEL: Record<string, string> = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };

/**
 * /courses — the genuinely public course catalogue, reachable by
 * anyone with no login at all. This is what the landing page's
 * "Browse Courses" button now points to — previously that button led
 * to /trainee/courses, which forced a login wall before a visitor saw
 * anything. Fed by the anonymous GET /api/courses/public.
 */
export default function PublicCoursesPage() {
  const [courses, setCourses] = useState<PublicCourseRow[] | null>(null);

  useEffect(() => {
    fetch("/api/courses/public")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Trainee Login", href: "/trainee/login" },
          { label: "Employer Login", href: "/employer/login" },
          { label: "Staff Login", href: "/admin/login" },
        ]}
      />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Courses</h1>
        <p className="mt-1 text-sm text-gray-500">Browse what&apos;s available — sign up when you&apos;re ready to enroll.</p>

        <div className="mt-8 space-y-4">
          {courses === null && <SkeletonList rows={4} />}
          {courses?.length === 0 && <EmptyState title="No courses available yet" description="Check back soon." />}

          {courses?.map((course) => (
            <a key={course.id} href={`/courses/${course.id}`}>
              <Card interactive className="flex items-center gap-4 hover:border-brand-teal">
                {course.flyerUrl && (
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-brand-mint">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a real, dynamically-uploaded external URL. */}
                    <img src={course.flyerUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-semibold text-brand-ink">{course.title}</span>
                    {course.isFree && <Badge variant="success">Free</Badge>}
                    {course.level && <Badge variant="neutral">{LEVEL_LABEL[course.level]}</Badge>}
                  </div>
                  {course.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{course.description}</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    {course.category && `${course.category} · `}
                    {course.moduleCount} module{course.moduleCount === 1 ? "" : "s"}
                  </p>
                </div>
              </Card>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
