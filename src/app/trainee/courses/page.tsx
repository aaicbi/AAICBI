"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  _count: { modules: number };
}

export default function TraineeCoursesPage() {
  const [courses, setCourses] = useState<CourseRow[] | null>(null);

  useEffect(() => {
    fetch("/api/courses/published")
      .then((r) => r.json())
      .then(setCourses);
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
          { label: "Settings", href: "/trainee/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Courses</h1>

        <div className="mt-6 space-y-3">
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
              <Card interactive className="flex items-center justify-between hover:border-brand-teal">
                <div>
                  <div className="font-display text-base font-semibold text-brand-ink">{course.title}</div>
                  {course.description && <div className="mt-0.5 text-sm text-gray-600">{course.description}</div>}
                  <div className="mt-1.5 text-xs text-gray-500">
                    {course._count.modules} module{course._count.modules === 1 ? "" : "s"}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-brand-teal">View →</span>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
