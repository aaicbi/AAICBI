"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Flame, BookOpen, GraduationCap, CheckCircle2, ClipboardCheck } from "lucide-react";

interface MyActivityDto {
  coursesStarted: number;
  coursesCompleted: number;
  lessonsCompleted: number;
  assessmentsCompleted: number;
  currentStreakDays: number;
  recentlyExplored: string[];
}

/**
 * Analytics System Phase 1 — "Your Learning Activity" (task Section
 * 24). Entirely the trainee's own data; the personal-analytics
 * counterpart to the admin-facing /admin/analytics dashboard, reusing
 * the same underlying tables.
 */
export default function MyActivityPage() {
  const [activity, setActivity] = useState<MyActivityDto | null>(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    setActivity(null);
    fetch("/api/trainee/my-activity")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setActivity)
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
          { label: "My Activity", href: "/trainee/my-activity" },
          { label: "Messages", href: "/trainee/messages" },
          { label: "My Profile", href: "/trainee/profile" },
          { label: "Settings", href: "/trainee/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Your Learning Activity</h1>
        <p className="mt-1 text-sm text-gray-500">A quick look at your own progress across the platform.</p>

        {error ? (
          <div className="mt-6">
            <ErrorState message="We couldn't load your activity." onRetry={load} />
          </div>
        ) : activity === null ? (
          <div className="mt-6">
            <SkeletonList />
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Card>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Icon icon={BookOpen} size="sm" /> Courses Started
                </p>
                <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{activity.coursesStarted}</p>
              </Card>
              <Card>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Icon icon={GraduationCap} size="sm" /> Courses Completed
                </p>
                <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{activity.coursesCompleted}</p>
              </Card>
              <Card>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Icon icon={CheckCircle2} size="sm" /> Lessons Completed
                </p>
                <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{activity.lessonsCompleted}</p>
              </Card>
              <Card>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Icon icon={ClipboardCheck} size="sm" /> Assessments Completed
                </p>
                <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{activity.assessmentsCompleted}</p>
              </Card>
              <Card variant={activity.currentStreakDays > 0 ? "celebratory" : "default"}>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Icon icon={Flame} size="sm" /> Current Streak
                </p>
                <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">
                  {activity.currentStreakDays} day{activity.currentStreakDays === 1 ? "" : "s"}
                </p>
              </Card>
            </div>

            <Card className="mt-6">
              <p className="text-sm font-semibold text-brand-ink">Areas You've Been Exploring</p>
              {activity.recentlyExplored.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">
                  Browse a few courses and this will fill in with what you've been looking at recently.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {activity.recentlyExplored.map((title) => (
                    <Badge key={title} variant="neutral">
                      {title}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </main>
    </>
  );
}
