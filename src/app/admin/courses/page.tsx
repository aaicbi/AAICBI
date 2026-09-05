"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  _count: { modules: number };
}

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<CourseRow[] | null>(null);

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then(setCourses);
  }, []);

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Courses", href: "/admin/courses" },
          { label: "Settings", href: "/admin/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-brand-ink">Courses</h1>
          <Button href="/admin/courses/new">+ Create Course</Button>
        </div>

        <div className="mt-8 space-y-3">
          {courses === null && <SkeletonList rows={4} />}

          {courses?.length === 0 && (
            <EmptyState
              illustration={<GrowthPathDoodle className="h-full w-full" />}
              title="No courses yet"
              description="Create one, then add modules, lessons, and materials to it."
            />
          )}

          {courses?.map((course) => (
            <Link key={course.id} href={`/admin/courses/${course.id}`}>
              <Card interactive className="flex items-center justify-between hover:border-brand-teal">
                <div>
                  <div className="font-display font-semibold text-brand-ink">{course.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span>
                      {course._count.modules} module{course._count.modules === 1 ? "" : "s"}
                    </span>
                    <Badge variant={course.published ? "success" : "neutral"}>
                      {course.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-brand-teal">Manage →</span>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
