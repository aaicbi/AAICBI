"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import CorrectnessMark from "@/components/ui/CorrectnessMark";
import Icon from "@/components/ui/Icon";
import { ArrowRight } from "lucide-react";

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  isFree: boolean;
  isPaid: boolean;
  isEnrolled: boolean;
  isExpired: boolean;
  // Course catalogue upgrade
  category: string | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  flyerUrl: string | null;
  _count: { modules: number };
}

const LEVEL_LABEL: Record<string, string> = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };

export default function TraineeCoursesPage() {
  const [courses, setCourses] = useState<CourseRow[] | null>(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    setCourses(null);
    // Bug fix — this used to do `.then((r) => r.json())` with no
    // `r.ok` check, so a non-200 response (e.g. this session isn't
    // actually a TRAINEE — every role shares one login cookie in this
    // app, so a stale admin/employer session hitting a trainee-only
    // API is a real, reachable case, not just a hypothetical) got its
    // error-JSON body handed straight to setCourses, and
    // `courses.map` then crashed the whole page instead of showing a
    // real error.
    fetch("/api/courses/published")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCourses)
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Dashboard", href: "/trainee/dashboard" },
          { label: "Courses", href: "/trainee/courses" },
          { label: "My Downloads", href: "/trainee/downloads" },
          { label: "Introductions", href: "/trainee/introductions" },
          { label: "Job Board", href: "/trainee/job-postings" },
          { label: "Ask Loop", href: "/trainee/buddy" },
          { label: "My Profile", href: "/trainee/profile" },
          { label: "Settings", href: "/trainee/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Courses</h1>

        <div className="mt-6 space-y-3">
          {error ? (
            <ErrorState message="We couldn't load your courses." onRetry={load} />
          ) : (
            <>
          {courses === null && <SkeletonList rows={4} />}

          {courses?.length === 0 && (
            <EmptyState
              illustration={<GrowthPathDoodle className="h-full w-full" />}
              title="No courses published yet"
              description="Check back soon — new courses will show up here as they're published."
            />
          )}

          {courses?.map((course) => (
            <Link key={course.id} href={`/trainee/courses/${course.id}`}>
              <Card interactive className="flex items-center gap-4 hover:border-brand-teal">
                {course.flyerUrl && (
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-brand-mint">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a real, dynamically-uploaded external URL. */}
                    <img src={course.flyerUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-semibold text-brand-ink">{course.title}</span>
                    {course.isPaid && course.isEnrolled ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-mint px-2 py-0.5 text-[10px] font-semibold text-brand-teal">
                        PAID <CorrectnessMark state="correct" label={undefined} />
                      </span>
                    ) : course.isExpired ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-brand-rose">
                        EXPIRED
                      </span>
                    ) : course.isFree ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                        FREE
                      </span>
                    ) : null}
                    {course.level && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                        {LEVEL_LABEL[course.level]}
                      </span>
                    )}
                  </div>
                  {course.description && <div className="mt-0.5 text-sm text-gray-600">{course.description}</div>}
                  <div className="mt-1.5 text-xs text-gray-500">
                    {course.category && `${course.category} · `}
                    {course._count.modules} module{course._count.modules === 1 ? "" : "s"}
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-teal">
                  View <Icon icon={ArrowRight} size="sm" />
                </span>
              </Card>
            </Link>
          ))}
            </>
          )}
        </div>
      </main>
    </>
  );
}
