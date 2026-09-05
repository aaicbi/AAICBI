"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface ThreadDto {
  id: string;
  title: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  lesson: { id: string; title: string };
  _count: { posts: number };
}

export default function CourseQaPage({ params }: { params: { id: string } }) {
  const [threads, setThreads] = useState<ThreadDto[] | null>(null);
  const [threadsError, setThreadsError] = useState(false);

  function load() {
    setThreadsError(false);
    fetch(`/api/courses/${params.id}/qa/threads`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setThreads)
      .catch(() => setThreadsError(true));
  }

  useEffect(() => {
    load();
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
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Q&amp;A</h1>
        <p className="mt-1 text-sm text-gray-500">Every question thread across this course, most recent first.</p>

        <div className="mt-6 space-y-3">
          {threadsError ? (
            <ErrorState message="We couldn't load Q&A threads." onRetry={load} />
          ) : threads === null ? (
            <SkeletonList />
          ) : threads.length === 0 ? (
            <p className="text-sm text-gray-500">No questions posted yet.</p>
          ) : (
            threads.map((t) => (
              <a key={t.id} href={`/admin/courses/${params.id}/qa/${t.id}`}>
                <Card className="transition-colors hover:border-brand-teal">
                  <p className="font-display font-semibold text-brand-ink">{t.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {t.lesson.title} · {t.createdBy.name} · {t._count.posts}{" "}
                    {t._count.posts === 1 ? "reply" : "replies"}
                  </p>
                </Card>
              </a>
            ))
          )}
        </div>
      </main>
    </>
  );
}
