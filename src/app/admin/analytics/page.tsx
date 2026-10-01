"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { BarChart3, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import LiveActivityCard from "@/components/analytics/LiveActivityCard";

interface PlatformOverview {
  registeredUsers: number | null;
  newRegistrations: number | null;
  currentlyActive: number | null;
  enrollments: number;
  completions: number;
  conversionRate: number | null;
}
interface FunnelStage {
  label: string;
  count: number;
  percentOfPrevious: number | null;
}
interface CoursePerformanceRow {
  courseId: string;
  title: string;
  views: number;
  uniqueViewers: number;
  anonymousViews: number;
  enrollments: number;
  completions: number;
  completionRate: number | null;
}
interface FeatureUsageRow {
  feature: string;
  totalUses: number;
  uniqueUsers: number;
}
interface TrendPoint {
  date: string;
  registrations: number;
  enrollments: number;
}
type LifecycleBreakdown = { NEW: number; ACTIVE: number; INACTIVE: number; COMPLETER: number } | null;
interface CategoryCount {
  category: string;
  count: number;
}
interface SearchQueryCount {
  query: string;
  count: number;
}
interface SearchDemand {
  topQueries: SearchQueryCount[];
  zeroResultQueries: SearchQueryCount[];
}
interface TopicCount {
  topic: string;
  traineeCount: number;
}
interface InterestSummary {
  topTopics: TopicCount[];
  emergingTopics: TopicCount[];
}
interface SegmentSummary {
  key: string;
  label: string;
  count: number;
}
interface CohortRow {
  weekStart: string;
  size: number;
  activeCount: number;
  completedCount: number;
  completionRate: number | null;
  topReferrerSource: string | null;
}
interface Insight {
  type: string;
  summary: string;
  evidence: Record<string, number | string>;
}

interface AnalyticsDto {
  days: number;
  overview: PlatformOverview;
  funnel: FunnelStage[];
  coursePerformance: CoursePerformanceRow[];
  featureUsage: FeatureUsageRow[];
  trend: TrendPoint[];
  lifecycle: LifecycleBreakdown;
  trafficSources: CategoryCount[] | null;
  deviceBreakdown: CategoryCount[] | null;
  searchDemand: SearchDemand | null;
  interestSummary: InterestSummary | null;
  segments: SegmentSummary[] | null;
  cohorts: CohortRow[] | null;
  insights: Insight[] | null;
}

const DAY_OPTIONS = [7, 30, 90];

const NAV = [
  { label: "Examinations", href: "/admin/dashboard" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Performance", href: "/admin/performance" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Payments", href: "/admin/payments" },
  { label: "My Profile", href: "/admin/profile" },
  { label: "Settings", href: "/admin/settings" },
];

/**
 * Analytics System — /admin/analytics. SUPER_ADMIN/ADMIN see the
 * platform-wide picture; INSTRUCTOR sees the identical layout scoped to
 * only their own courses (enforced server-side in
 * GET /api/admin/analytics — this page never decides scope itself,
 * just renders whatever the API returns, including omitting a section
 * entirely when the API sends null for it).
 *
 * Phase 2 extended the funnel with two new leading "Visitors"/"Viewed a
 * Course" stages and added the Traffic Sources/Device Breakdown
 * sections — all sourced from the new, opt-in, anonymous VisitorEvent
 * table (see src/lib/analytics/aggregate.ts's own comments on each).
 */
export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsDto | null>(null);
  const [error, setError] = useState(false);

  function load(selectedDays: number) {
    setError(false);
    setData(null);
    fetch(`/api/admin/analytics?days=${selectedDays}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }

  useEffect(() => {
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-ink">
              <Icon icon={BarChart3} size="lg" /> Analytics
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              How people are using the platform — registrations, enrollments, content, and features.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-brand-gray">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 text-sm font-semibold ${d === days ? "bg-brand-teal text-white" : "bg-white text-brand-ink hover:bg-gray-50"}`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <Button href={`/api/admin/analytics/export.csv?days=${days}`} variant="secondary" size="sm" iconLeft={<Icon icon={Download} size="sm" />}>
              Export CSV
            </Button>
            <Button href={`/api/admin/analytics/report.pdf?days=${days}`} variant="secondary" size="sm" iconLeft={<Icon icon={Download} size="sm" />}>
              Download Report (PDF)
            </Button>
          </div>
        </div>

        {/* Live Activity — its own independent poll, not gated by the
            main dashboard's own loading/error state below. Silently
            renders nothing for an INSTRUCTOR session (the route itself
            is SUPER_ADMIN/ADMIN only — see getLiveActivity's own
            comment), and nothing while its first poll is still in
            flight. */}
        <LiveActivityCard />

        {error ? (
          <div className="mt-6">
            <ErrorState message="We couldn't load analytics." onRetry={() => load(days)} />
          </div>
        ) : data === null ? (
          <div className="mt-6">
            <SkeletonList />
          </div>
        ) : (
          <>
            {/* KPI cards — platform-wide-only numbers (registeredUsers,
                newRegistrations, currentlyActive) are simply absent from
                an INSTRUCTOR's scoped payload (null), so those cards
                don't render rather than showing a misleading zero. */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {data.overview.registeredUsers !== null && (
                <Card>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Registered Users</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{data.overview.registeredUsers}</p>
                </Card>
              )}
              {data.overview.newRegistrations !== null && (
                <Card>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">New Registrations</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{data.overview.newRegistrations}</p>
                </Card>
              )}
              {data.overview.currentlyActive !== null && (
                <Card>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Currently Active</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{data.overview.currentlyActive}</p>
                </Card>
              )}
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Enrollments</p>
                <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{data.overview.enrollments}</p>
              </Card>
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Completions</p>
                <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{data.overview.completions}</p>
              </Card>
              <Card variant="celebratory">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Conversion Rate</p>
                <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">
                  {data.overview.conversionRate != null ? `${data.overview.conversionRate}%` : "—"}
                </p>
              </Card>
            </div>

            {/* Automated Insights — Phase 4, platform-wide only. Real,
                standalone value independent of the AI assistant — no LLM
                call involved, just this period vs. the previous one. */}
            {data.insights && data.insights.length > 0 && (
              <Card className="mt-6">
                <p className="text-sm font-semibold text-brand-ink">Automated Insights</p>
                <p className="mt-1 text-xs text-gray-500">
                  This period vs. the immediately-preceding period of the same length — a behavioural association, not a causal claim.
                </p>
                <ul className="mt-3 space-y-2">
                  {data.insights.map((insight) => (
                    <li key={insight.type} className="rounded-lg bg-brand-mint/40 px-3 py-2 text-sm text-brand-ink">
                      {insight.summary}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Conversion funnel */}
            <Card className="mt-6">
              <p className="text-sm font-semibold text-brand-ink">Conversion Funnel — this period&apos;s cohort</p>
              <p className="mt-1 text-xs text-gray-500">
                Each stage counts people who reached it during the selected window — a behavioural association, not a causal claim.
              </p>
              <div className="mt-4 space-y-2">
                {data.funnel.map((stage, i) => (
                  <div key={stage.label} className="flex items-center gap-3">
                    <div className="w-36 shrink-0 text-sm text-gray-600">{stage.label}</div>
                    <div className="h-6 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-brand-teal"
                        style={{
                          width: `${data.funnel[0]?.count ? Math.max(4, (stage.count / data.funnel[0].count) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="w-28 shrink-0 text-right text-sm font-semibold text-brand-ink">
                      {stage.count}
                      {i > 0 && stage.percentOfPrevious != null && (
                        <span className="ml-1 font-normal text-gray-500">({stage.percentOfPrevious}%)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Trend chart */}
            {data.trend.length > 0 && (
              <Card className="mt-6">
                <p className="text-sm font-semibold text-brand-ink">Registrations &amp; Enrollments Over Time</p>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trend} margin={{ top: 8, right: 16, bottom: 8, left: -12 }}>
                      <CartesianGrid stroke="#E4EEE7" strokeDasharray="3 3" />
                      <XAxis dataKey="date" stroke="#6B7280" fontSize={11} tickLine={false} />
                      <YAxis stroke="#6B7280" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      {data.overview.registeredUsers !== null && (
                        <Line type="monotone" dataKey="registrations" name="Registrations" stroke="#016B61" strokeWidth={2} dot={{ r: 3 }} />
                      )}
                      <Line type="monotone" dataKey="enrollments" name="Enrollments" stroke="#D99A34" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Content performance */}
            <Card className="mt-6">
              <p className="text-sm font-semibold text-brand-ink">Content Performance</p>
              {data.coursePerformance.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No course activity in this period yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-brand-gray text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="pb-2 pr-4">Course</th>
                        <th className="pb-2 pr-4 text-right">Views</th>
                        <th className="pb-2 pr-4 text-right">Unique Viewers</th>
                        <th className="pb-2 pr-4 text-right">Anonymous Views</th>
                        <th className="pb-2 pr-4 text-right">Enrollments</th>
                        <th className="pb-2 pr-4 text-right">Completions</th>
                        <th className="pb-2 text-right">Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.coursePerformance.map((row) => (
                        <tr key={row.courseId} className="border-b border-gray-100">
                          <td className="py-2 pr-4 font-medium text-brand-ink">{row.title}</td>
                          <td className="py-2 pr-4 text-right">{row.views}</td>
                          <td className="py-2 pr-4 text-right">{row.uniqueViewers}</td>
                          <td className="py-2 pr-4 text-right">{row.anonymousViews}</td>
                          <td className="py-2 pr-4 text-right">{row.enrollments}</td>
                          <td className="py-2 pr-4 text-right">{row.completions}</td>
                          <td className="py-2 text-right">{row.completionRate != null ? `${row.completionRate}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Feature usage */}
            <Card className="mt-6">
              <p className="text-sm font-semibold text-brand-ink">Feature Usage</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-gray text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-4">Feature</th>
                      <th className="pb-2 pr-4 text-right">Total Uses</th>
                      <th className="pb-2 text-right">Unique Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.featureUsage.map((row) => (
                      <tr key={row.feature} className="border-b border-gray-100">
                        <td className="py-2 pr-4 font-medium text-brand-ink">{row.feature}</td>
                        <td className="py-2 pr-4 text-right">{row.totalUses}</td>
                        <td className="py-2 text-right">{row.uniqueUsers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Lifecycle breakdown — platform-wide only */}
            {data.lifecycle && (
              <Card className="mt-6">
                <p className="text-sm font-semibold text-brand-ink">Trainee Lifecycle</p>
                <p className="mt-1 text-xs text-gray-500">A snapshot as of now, not scoped to the selected period.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="neutral">New: {data.lifecycle.NEW}</Badge>
                  <Badge variant="success">Active: {data.lifecycle.ACTIVE}</Badge>
                  <Badge variant="danger">Inactive: {data.lifecycle.INACTIVE}</Badge>
                  <Badge variant="gold">Completer: {data.lifecycle.COMPLETER}</Badge>
                </div>
              </Card>
            )}

            {/* Traffic Sources & Device Breakdown — Phase 2, platform-wide
                only (anonymous visitors aren't scoped to one instructor). */}
            {(data.trafficSources || data.deviceBreakdown) && (
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {data.trafficSources && (
                  <Card>
                    <p className="text-sm font-semibold text-brand-ink">Traffic Sources</p>
                    <p className="mt-1 text-xs text-gray-500">Where anonymous visitors came from — only visitors who accepted cookie tracking.</p>
                    <div className="mt-3 space-y-1.5">
                      {data.trafficSources.length === 0 ? (
                        <p className="text-sm text-gray-500">No visitor activity in this period yet.</p>
                      ) : (
                        data.trafficSources.map((row) => (
                          <div key={row.category} className="flex items-center justify-between text-sm">
                            <span className="capitalize text-gray-700">{row.category}</span>
                            <span className="font-semibold text-brand-ink">{row.count}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                )}
                {data.deviceBreakdown && (
                  <Card>
                    <p className="text-sm font-semibold text-brand-ink">Device Breakdown</p>
                    <p className="mt-1 text-xs text-gray-500">Coarse device category only — never a raw device/browser string.</p>
                    <div className="mt-3 space-y-1.5">
                      {data.deviceBreakdown.length === 0 ? (
                        <p className="text-sm text-gray-500">No visitor activity in this period yet.</p>
                      ) : (
                        data.deviceBreakdown.map((row) => (
                          <div key={row.category} className="flex items-center justify-between text-sm">
                            <span className="capitalize text-gray-700">{row.category}</span>
                            <span className="font-semibold text-brand-ink">{row.count}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* What Are Users Looking For? — Phase 3, platform-wide only. */}
            {data.searchDemand && (
              <Card className="mt-6">
                <p className="text-sm font-semibold text-brand-ink">What Are Users Looking For?</p>
                <p className="mt-1 text-xs text-gray-500">Course-catalog searches this period — zero-result searches are real, unmet demand.</p>
                {data.searchDemand.topQueries.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500">No searches in this period yet.</p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Top Searches</p>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {data.searchDemand.topQueries.slice(0, 10).map((q) => (
                          <li key={q.query} className="flex items-center justify-between">
                            <span className="text-gray-700">{q.query}</span>
                            <span className="font-semibold text-brand-ink">{q.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Zero-Result Searches</p>
                      {data.searchDemand.zeroResultQueries.length === 0 ? (
                        <p className="mt-2 text-sm text-gray-500">None — every search found something.</p>
                      ) : (
                        <ul className="mt-2 space-y-1.5 text-sm">
                          {data.searchDemand.zeroResultQueries.slice(0, 10).map((q) => (
                            <li key={q.query} className="flex items-center justify-between">
                              <span className="text-brand-rose">{q.query}</span>
                              <span className="font-semibold text-brand-ink">{q.count}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Interest Intelligence — Phase 3, platform-wide only. Topic
                is whatever an admin typed into Course.category, used
                as-is (see interestScoring.ts's own comment). */}
            {data.interestSummary && (
              <Card className="mt-6">
                <p className="text-sm font-semibold text-brand-ink">Interest Intelligence</p>
                <p className="mt-1 text-xs text-gray-500">
                  How many trainees currently show primary/secondary interest in each topic — a behavioural association, not a causal claim.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Most Popular Skill Areas</p>
                    {data.interestSummary.topTopics.length === 0 ? (
                      <p className="mt-2 text-sm text-gray-500">Not enough activity yet.</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {data.interestSummary.topTopics.slice(0, 8).map((t) => (
                          <li key={t.topic} className="flex items-center justify-between">
                            <span className="text-gray-700">{t.topic}</span>
                            <span className="font-semibold text-brand-ink">{t.traineeCount}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Emerging Skill Interests</p>
                    {data.interestSummary.emergingTopics.length === 0 ? (
                      <p className="mt-2 text-sm text-gray-500">Nothing newly emerging right now.</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {data.interestSummary.emergingTopics.slice(0, 8).map((t) => (
                          <li key={t.topic} className="flex items-center justify-between">
                            <span className="text-gray-700">{t.topic}</span>
                            <span className="font-semibold text-brand-ink">{t.traineeCount}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Segments — Phase 3, platform-wide only. Each card links to
                the filtered trainee list. */}
            {data.segments && data.segments.length > 0 && (
              <Card className="mt-6">
                <p className="text-sm font-semibold text-brand-ink">Segments</p>
                <p className="mt-1 text-xs text-gray-500">Click a segment to see the matching trainees.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.segments.map((s) => (
                    <a key={s.key} href={`/admin/trainees?segment=${encodeURIComponent(s.key)}`}>
                      <Badge variant="neutral">
                        {s.label}: {s.count}
                      </Badge>
                    </a>
                  ))}
                </div>
              </Card>
            )}

            {/* Cohorts — Phase 3, platform-wide only. A single
                registration-cohort summary table, not the full
                weeks-since-joining retention matrix. */}
            {data.cohorts && data.cohorts.length > 0 && (
              <Card className="mt-6">
                <p className="text-sm font-semibold text-brand-ink">Cohorts — by registration week</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-brand-gray text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="pb-2 pr-4">Week</th>
                        <th className="pb-2 pr-4 text-right">Size</th>
                        <th className="pb-2 pr-4 text-right">Active</th>
                        <th className="pb-2 pr-4 text-right">Completed</th>
                        <th className="pb-2 pr-4 text-right">Completion Rate</th>
                        <th className="pb-2 text-right">Top Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cohorts.map((c) => (
                        <tr key={c.weekStart} className="border-b border-gray-100">
                          <td className="py-2 pr-4 font-medium text-brand-ink">{c.weekStart}</td>
                          <td className="py-2 pr-4 text-right">{c.size}</td>
                          <td className="py-2 pr-4 text-right">{c.activeCount}</td>
                          <td className="py-2 pr-4 text-right">{c.completedCount}</td>
                          <td className="py-2 pr-4 text-right">{c.completionRate != null ? `${c.completionRate}%` : "—"}</td>
                          <td className="py-2 text-right capitalize">{c.topReferrerSource ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </main>
    </>
  );
}
