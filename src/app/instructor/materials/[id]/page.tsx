"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/instructor/LogoutButton";
import BackLink from "@/components/ui/BackLink";
import Card from "@/components/ui/Card";
import MaterialTypeIcon, { MaterialIconType } from "@/components/ui/MaterialTypeIcon";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";

interface MaterialItem {
  id: string;
  type: MaterialIconType;
  title: string;
  url: string;
}
interface LessonItem {
  id: string;
  title: string;
  materials: MaterialItem[];
}
interface ModuleItem {
  id: string;
  title: string;
  lessons: LessonItem[];
}
interface CourseDetail {
  id: string;
  title: string;
  modules: ModuleItem[];
}

const NAV = [
  { label: "Dashboard", href: "/instructor/dashboard" },
  { label: "My Courses", href: "/instructor/courses" },
  { label: "Teaching Materials", href: "/instructor/materials" },
  { label: "My Payments", href: "/instructor/payments" },
  { label: "Agreement", href: "/instructor/agreement" },
];

/**
 * /instructor/materials/[id] — a read-only module → lesson → material
 * tree, reusing GET /api/courses/[id] (already returns the full tree
 * and already permits the owning instructor — see that route's own
 * isOwner check). No edit affordances: material editing stays on the
 * existing /admin/courses/[id] builder, which INSTRUCTOR retains access
 * to per Phase 1's own scope note (existing admin access is left
 * intact; this page is a lighter-weight browse view alongside it).
 */
export default function InstructorMaterialsCoursePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [gateChecked, setGateChecked] = useState(false);
  const [course, setCourse] = useState<CourseDetail | null | undefined>(undefined);

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
    fetch(`/api/courses/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCourse)
      .catch(() => setCourse(null));
  }, [gateChecked, params.id]);

  if (!gateChecked) return null;

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <BackLink href="/instructor/materials" className="text-sm text-brand-teal hover:underline">
          Back to Teaching Materials
        </BackLink>

        {course === undefined && <div className="mt-6"><SkeletonList rows={3} /></div>}
        {course === null && (
          <div className="mt-6">
            <EmptyState title="Course not found" description="This course may no longer be assigned to you." />
          </div>
        )}
        {course && (
          <>
            <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">{course.title}</h1>

            <div className="mt-6 space-y-4">
              {course.modules.length === 0 && <EmptyState title="No modules yet" description="Modules will appear here once added." />}
              {course.modules.map((m, mi) => (
                <Card key={m.id}>
                  <p className="font-semibold text-brand-ink">
                    Module {mi + 1}: {m.title}
                  </p>
                  <div className="mt-3 space-y-3">
                    {m.lessons.map((l, li) => (
                      <div key={l.id} className="border-l-2 border-brand-gray pl-3">
                        <p className="text-sm font-semibold text-gray-700">
                          Lesson {li + 1}: {l.title}
                        </p>
                        <ul className="mt-1 space-y-1">
                          {l.materials.map((mat) => (
                            <li key={mat.id} className="flex items-center gap-2 text-sm text-gray-600">
                              <MaterialTypeIcon type={mat.type} />
                              <a href={mat.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand-teal hover:underline">
                                {mat.title}
                              </a>
                            </li>
                          ))}
                          {l.materials.length === 0 && <li className="text-xs text-gray-400">No materials in this lesson.</li>}
                        </ul>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
