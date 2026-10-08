"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import CorrectnessMark from "@/components/ui/CorrectnessMark";
import PriceTag from "@/components/courses/PriceTag";
import CourseCard from "@/components/courses/CourseCard";
import { TRAINEE_NAV } from "@/lib/trainee/nav";

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  isFree: boolean;
  isPaid: boolean;
  isEnrolled: boolean;
  isExpired: boolean;
  priceKobo: number | null;
  discountPercent: number | null;
  effectivePriceKobo: number | null;
  billingInterval: string | null;
  // Course catalogue upgrade
  category: string | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  flyerUrl: string | null;
  publisherName: string | null;
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
        nav={TRAINEE_NAV}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
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

          {courses && courses.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  href={`/trainee/courses/${course.id}`}
                  title={course.title}
                  publisher={course.publisherName}
                  description={course.description}
                  imageUrl={course.flyerUrl}
                  badges={
                    <>
                      {course.isPaid && course.isEnrolled ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-mint px-2 py-0.5 text-xs font-semibold text-brand-teal">
                          PAID <CorrectnessMark state="correct" label={undefined} />
                        </span>
                      ) : course.isExpired ? (
                        <span className="rounded-full bg-brand-roseLight px-2 py-0.5 text-xs font-semibold text-brand-rose">EXPIRED</span>
                      ) : course.isFree ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">FREE</span>
                      ) : null}
                      {course.level && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{LEVEL_LABEL[course.level]}</span>}
                    </>
                  }
                  price={
                    !course.isFree && !course.isEnrolled && course.priceKobo != null ? (
                      <PriceTag priceKobo={course.priceKobo} discountPercent={course.discountPercent} effectivePriceKobo={course.effectivePriceKobo} billingInterval={course.billingInterval} size="sm" />
                    ) : null
                  }
                  meta={[course.category, `${course._count.modules} module${course._count.modules === 1 ? "" : "s"}`]}
                  cta={course.isEnrolled ? "Continue learning" : "View course"}
                />
              ))}
            </div>
          )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
