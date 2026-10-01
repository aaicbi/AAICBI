"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Flame, BookOpen, GraduationCap, CheckCircle2, ClipboardCheck, Download, Target, Trophy } from "lucide-react";
import { TRAINEE_NAV } from "@/lib/trainee/nav";

interface AssessmentStats {
  totalAttempts: number;
  totalPassed: number;
  totalFailed: number;
  averageScorePercent: number | null;
  highestScorePercent: number | null;
}

interface MyActivityDto {
  coursesStarted: number;
  coursesCompleted: number;
  lessonsCompleted: number;
  assessmentsCompleted: number;
  currentStreakDays: number;
  recentlyExplored: string[];
  primaryInterest: string | null;
  secondaryInterests: string[];
  assessmentStats: AssessmentStats;
}

/**
 * Analytics System — "Your Learning Activity" (task Section 24).
 * Entirely the trainee's own data; the personal-analytics counterpart
 * to the admin-facing /admin/analytics dashboard, reusing the same
 * underlying tables. Phase 3 added the Primary/Secondary Interest
 * labels, from the same Interest Intelligence engine the admin
 * trainee-detail page uses.
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
        nav={TRAINEE_NAV}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">Analytics &amp; Reports</h1>
            <p className="mt-1 text-sm text-gray-500">A quick look at your own progress and performance across the platform.</p>
          </div>
          {activity && (
            <Button href="/api/trainee/my-activity/report.pdf" variant="secondary" size="sm" iconLeft={<Icon icon={Download} size="sm" />}>
              Download My Report (PDF)
            </Button>
          )}
        </div>

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

            {/* Dashboard/Examination redesign — real assessment
                performance (avg/highest score, passed/failed counts),
                computed server-side from the trainee's own SUBMITTED
                attempts. Omitted entirely when there's genuinely no
                submitted attempt yet, never shown as zeroes. */}
            {activity.assessmentStats.totalAttempts > 0 && (
              <Card className="mt-6">
                <p className="text-sm font-semibold text-brand-ink">Assessment Performance</p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="flex items-center gap-1 text-xs text-gray-500">
                      <Icon icon={CheckCircle2} size="sm" /> Passed
                    </p>
                    <p className="mt-1 font-display text-xl font-semibold text-brand-tealDeep">{activity.assessmentStats.totalPassed}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-xs text-gray-500">
                      <Icon icon={Target} size="sm" /> Failed
                    </p>
                    <p className="mt-1 font-display text-xl font-semibold text-brand-rose">{activity.assessmentStats.totalFailed}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Average Score</p>
                    <p className="mt-1 font-display text-xl font-semibold text-brand-ink">
                      {activity.assessmentStats.averageScorePercent != null ? `${activity.assessmentStats.averageScorePercent}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-xs text-gray-500">
                      <Icon icon={Trophy} size="sm" /> Highest Score
                    </p>
                    <p className="mt-1 font-display text-xl font-semibold text-brand-ink">
                      {activity.assessmentStats.highestScorePercent != null ? `${activity.assessmentStats.highestScorePercent}%` : "—"}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {(activity.primaryInterest || activity.secondaryInterests.length > 0) && (
              <Card className="mt-6">
                <p className="text-sm font-semibold text-brand-ink">Your Interests</p>
                <p className="mt-1 text-xs text-gray-500">Inferred from your own activity — not a label, just a reflection of where you've spent time.</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {activity.primaryInterest && <Badge variant="gold">{activity.primaryInterest}</Badge>}
                  {activity.secondaryInterests.map((topic) => (
                    <Badge key={topic} variant="success">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

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
