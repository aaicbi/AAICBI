"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/instructor/LogoutButton";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";

interface CourseSummary {
  id: string;
  title: string;
  _count: { modules: number };
}

const NAV = [
  { label: "Dashboard", href: "/instructor/dashboard" },
  { label: "My Courses", href: "/instructor/courses" },
  { label: "Teaching Materials", href: "/instructor/materials" },
  { label: "My Payments", href: "/instructor/payments" },
  { label: "Agreement", href: "/instructor/agreement" },
];

/** /instructor/materials — pick a course, then browse its module → lesson → material tree read-only at /instructor/materials/[id]. */
export default function InstructorMaterialsPage() {
  const router = useRouter();
  const [gateChecked, setGateChecked] = useState(false);
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/instructor/agreement")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (data?.status !== "ACCEPTED") router.replace("/instructor/dashboard");
        else setGateChecked(true);
      })
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  useEffect(() => {
    if (!gateChecked) return;
    fetch("/api/courses")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCourses)
      .catch(() => setCourses([]));
  }, [gateChecked]);

  if (!gateChecked) return null;

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Teaching Materials</h1>
        <p className="mt-1 text-sm text-gray-500">Select a course to browse its modules, lessons, and materials.</p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {courses === null && <SkeletonList rows={3} />}
          {courses?.length === 0 && (
            <div className="sm:col-span-2">
              <EmptyState title="No courses assigned yet" description="Materials will appear here once you're assigned as instructor of record for a course." />
            </div>
          )}
          {courses?.map((c) => (
            <a key={c.id} href={`/instructor/materials/${c.id}`}>
              <Card interactive>
                <p className="font-semibold text-brand-ink">{c.title}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {c._count.modules} module{c._count.modules === 1 ? "" : "s"}
                </p>
              </Card>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
