"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

interface CourseDto {
  id: string;
  title: string;
  status: string;
  certificateTemplateId: string | null;
  certificateTemplate: { id: string; name: string } | null;
}
interface TemplateOption {
  id: string;
  name: string;
}

/**
 * Training Organizations, Phase 1 — the org's own minimal dashboard:
 * see the courses AAICBI staff has created for them (attributed to
 * their shadow staff account, see the course-list API's own comment),
 * and pick which of their own approved certificate templates applies
 * to each one. No course creation or content editing yet — that's
 * Phase 2 (see the plan this shipped from).
 */
export default function TrainingOrgDashboardPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseDto[] | null>(null);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { showToast } = useToast();

  // No server-side page check (client component) — same pattern
  // investor/dashboard's own page already establishes: a 401 here is
  // the real auth boundary, not just an error state.
  function load() {
    setLoadError(false);
    let redirected = false;
    fetch("/api/org/courses")
      .then((r) => {
        if (r.status === 401) {
          redirected = true;
          router.replace("/org/login");
          return Promise.reject();
        }
        return r.ok ? r.json() : Promise.reject();
      })
      .then((c) => {
        setCourses(c);
        return fetch("/api/org/certificate-templates").then((r) => (r.ok ? r.json() : []));
      })
      .then((t) => setTemplates(t))
      .catch(() => {
        if (!redirected) setLoadError(true);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function assignTemplate(courseId: string, certificateTemplateId: string) {
    setSavingId(courseId);
    const res = await fetch(`/api/org/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ certificateTemplateId: certificateTemplateId || null }),
    });
    setSavingId(null);
    if (!res.ok) {
      showToast("Could not update that course. Try again.", "error");
      return;
    }
    showToast("Saved.");
    load();
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Your Courses</h1>
      <p className="mt-1 text-sm text-gray-500">
        Pick which of your approved certificate templates applies to each course.
      </p>

      <div className="mt-6 space-y-3">
        {loadError ? (
          <ErrorState message="We couldn't load your courses." onRetry={load} />
        ) : courses === null ? (
          <SkeletonList />
        ) : courses.length === 0 ? (
          <EmptyState
            title="No courses yet"
            description="AAICBI will set up your first course and let you know once it's ready."
          />
        ) : (
          courses.map((c) => (
            <Card key={c.id}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-brand-ink">{c.title}</p>
                  <p className="text-xs text-gray-500">{c.status}</p>
                </div>
                <select
                  value={c.certificateTemplateId ?? ""}
                  onChange={(e) => assignTemplate(c.id, e.target.value)}
                  disabled={savingId === c.id || templates.length === 0}
                  className="shrink-0 rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                >
                  <option value="">AAICBI default</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </Card>
          ))
        )}
      </div>

      {templates.length === 0 && courses !== null && courses.length > 0 && (
        <p className="mt-4 text-xs text-gray-500">
          You don&apos;t have any approved certificate templates yet — your courses will use AAICBI&apos;s default
          certificate until one is ready.
        </p>
      )}
    </main>
  );
}
