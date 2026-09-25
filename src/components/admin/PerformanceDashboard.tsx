"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import { TrendingUp, TrendingDown, Minus, Download, AlertTriangle, X, MessageCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from "recharts";
import SuspendReasonModal from "@/components/messaging/SuspendReasonModal";

type Trend = "improving" | "declining" | "flat" | "insufficient-data";
type CertificationStatus = "ISSUED" | "REVOKED" | "NOT_YET";
type OverallStatus = "ON_TRACK" | "AT_RISK" | "COMPLETED";

interface TraineePerformanceRow {
  traineeId: string;
  name: string;
  email: string;
  completedModules: number;
  totalModules: number;
  completionPct: number;
  firstScore: number | null;
  bestScore: number | null;
  latestScore: number | null;
  averageScore: number | null;
  totalAttempts: number;
  passedOnAttempt: number | null;
  trend: Trend;
  certificationStatus: CertificationStatus;
  isAtRisk: boolean;
  atRiskReasons: string[];
  overallStatus: OverallStatus;
}
interface PerformanceKpis {
  totalTrainees: number;
  averageCompletionPct: number;
  averageAssessmentScore: number | null;
  atRiskCount: number;
  certificationRate: number;
}
interface ModuleAssessmentStat {
  moduleId: string;
  moduleTitle: string;
  hasAssessment: boolean;
  totalAttempts: number;
  distinctTraineesAttempted: number;
  averagePercentage: number | null;
  passRate: number | null;
}
interface TraineePerformanceAttemptPoint {
  examTitle: string;
  moduleTitle: string | null;
  attemptNumber: number;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: string | null;
  passMarkPercent: number | null;
  kind: "MODULE" | "COURSE_EXAM";
}
interface TraineePerformanceDetail {
  traineeId: string;
  name: string;
  email: string;
  completedModules: number;
  totalModules: number;
  completionPct: number;
  certificationStatus: CertificationStatus;
  isAtRisk: boolean;
  atRiskReasons: string[];
  attempts: TraineePerformanceAttemptPoint[];
}

type SortKey = "name" | "completionPct" | "firstScore" | "bestScore" | "latestScore" | "averageScore" | "totalAttempts" | "passedOnAttempt";

const TREND_ICON: Record<Trend, typeof TrendingUp> = { improving: TrendingUp, declining: TrendingDown, flat: Minus, "insufficient-data": Minus };
const TREND_COLOR: Record<Trend, string> = {
  improving: "text-brand-teal",
  declining: "text-brand-rose",
  flat: "text-gray-400",
  "insufficient-data": "text-gray-400",
};
const CERT_BADGE: Record<CertificationStatus, { variant: "success" | "danger" | "neutral"; label: string }> = {
  ISSUED: { variant: "success", label: "Issued" },
  REVOKED: { variant: "danger", label: "Revoked" },
  NOT_YET: { variant: "neutral", label: "Not yet" },
};
const STATUS_BADGE: Record<OverallStatus, { variant: "success" | "danger" | "gold"; label: string }> = {
  ON_TRACK: { variant: "success", label: "On Track" },
  AT_RISK: { variant: "danger", label: "At Risk" },
  COMPLETED: { variant: "gold", label: "Completed" },
};

function pct(value: number | null): string {
  return value != null ? `${Math.round(value)}%` : "—";
}

/**
 * The Trainee Performance dashboard body — KPIs, filters, table,
 * module drill-down, at-risk section, exports, and the trainee detail
 * modal. Factored out of the course-scoped page so the general
 * /admin/performance page (a course picker on top of this same view)
 * and the course-scoped /admin/courses/[id]/performance page can share
 * one implementation instead of two copies that could drift.
 */
export default function PerformanceDashboard({ courseId }: { courseId: string }) {
  const [kpis, setKpis] = useState<PerformanceKpis | null>(null);
  const [rows, setRows] = useState<TraineePerformanceRow[] | null>(null);
  const [modules, setModules] = useState<{ id: string; title: string; order: number }[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string }[]>([]);
  const [moduleStats, setModuleStats] = useState<ModuleAssessmentStat[] | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [cohortFilter, setCohortFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TraineePerformanceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIsSuperAdmin(data?.role === "SUPER_ADMIN"))
      .catch(() => {});
  }, []);

  async function messageTrainee(traineeId: string) {
    setMessaging(true);
    const res = await fetch("/api/conversations/direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peerType: "TRAINEE", peerId: traineeId }),
    });
    setMessaging(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Couldn't start a conversation with this trainee.", "error");
      return;
    }
    const { id } = await res.json();
    router.push(`/admin/messages/${id}`);
  }

  async function confirmSuspendTrainee(reason: string) {
    setSuspendModalOpen(false);
    if (!selectedTraineeId) return;
    const res = await fetch(`/api/admin/trainees/${selectedTraineeId}/messaging-suspension`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUSPEND", reason }),
    });
    if (res.ok) showToast("Messaging access suspended.", "success");
    else showToast("Couldn't suspend this trainee. Please try again.", "error");
  }

  function query(base: string) {
    const q = new URLSearchParams();
    if (cohortFilter) q.set("cohortId", cohortFilter);
    if (moduleFilter) q.set("moduleId", moduleFilter);
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  }

  // Switching courseId (the general dashboard's own dropdown) must
  // reset every filter and selection tied to the PREVIOUS course —
  // a stale cohortId/moduleId/selectedTraineeId from one course would
  // otherwise silently carry into a fetch against a different course.
  useEffect(() => {
    setCohortFilter("");
    setModuleFilter("");
    setSearch("");
    setSelectedTraineeId(null);
    setNotFound(false);
  }, [courseId]);

  useEffect(() => {
    setRows(null);
    setKpis(null);
    fetch(query(`/api/courses/${courseId}/performance`))
      .then(async (r) => {
        if (!r.ok) {
          setNotFound(true);
          return;
        }
        const data = await r.json();
        setKpis(data.kpis);
        setRows(data.rows);
        setModules(data.modules);
        setCohorts(data.cohorts);
      })
      .catch(() => setNotFound(true));
    fetch(query(`/api/courses/${courseId}/performance/modules`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setModuleStats(data.modules))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, cohortFilter, moduleFilter]);

  useEffect(() => {
    if (!selectedTraineeId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetch(`/api/courses/${courseId}/performance/trainees/${selectedTraineeId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setDetail(data))
      .finally(() => setDetailLoading(false));
  }, [selectedTraineeId, courseId]);

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)) : rows;
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") return sortDir * av.localeCompare(bv);
      return sortDir * ((av as number) - (bv as number));
    });
    return sorted;
  }, [rows, search, sortKey, sortDir]);

  const atRiskRows = useMemo(() => (rows ?? []).filter((r) => r.isAtRisk), [rows]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  // Every hook must run on every render regardless of notFound/loading —
  // both chartData and referenceMark are computed here, above any early
  // return, so the hook count never differs between renders.
  const chartData = useMemo(() => {
    if (!detail) return [];
    return detail.attempts.map((a, i) => ({
      index: i + 1,
      label: `${a.moduleTitle ?? "Course Exam"} · Attempt ${a.attemptNumber}`,
      module: a.kind === "MODULE" ? a.percentage : null,
      courseExam: a.kind === "COURSE_EXAM" ? a.percentage : null,
      passMarkPercent: a.passMarkPercent,
    }));
  }, [detail]);
  const referenceMark = detail?.attempts.find((a) => a.passMarkPercent != null)?.passMarkPercent ?? null;

  if (notFound) {
    return <p className="mt-6 text-center text-sm text-gray-600">Course not found, or you don&apos;t have access to it.</p>;
  }

  const loading = rows === null || kpis === null;

  if (loading) {
    return (
      <div className="mt-6">
        <SkeletonList rows={4} />
      </div>
    );
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        <Button href={query(`/api/courses/${courseId}/performance/export.csv`)} variant="secondary" size="sm" iconLeft={<Icon icon={Download} size="sm" />}>
          Export CSV
        </Button>
        <Button href={query(`/api/courses/${courseId}/performance/export.pdf`)} variant="secondary" size="sm" iconLeft={<Icon icon={Download} size="sm" />}>
          Export PDF
        </Button>
      </div>

      {/* KPI cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total Trainees</p>
          <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{kpis!.totalTrainees}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Avg. Completion</p>
          <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{kpis!.averageCompletionPct}%</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Avg. Assessment Score</p>
          <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{pct(kpis!.averageAssessmentScore)}</p>
        </Card>
        <Card variant={kpis!.atRiskCount > 0 ? "highlighted" : "default"}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">At Risk</p>
          <p className={`mt-1 font-display text-2xl font-semibold ${kpis!.atRiskCount > 0 ? "text-brand-rose" : "text-brand-ink"}`}>{kpis!.atRiskCount}</p>
        </Card>
        <Card variant="celebratory">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Certification Rate</p>
          <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{kpis!.certificationRate}%</p>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          value={cohortFilter}
          onChange={(e) => setCohortFilter(e.target.value)}
          className="rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        >
          <option value="">All cohorts</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        >
          <option value="">All modules</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search trainees…"
          className="flex-1 min-w-[160px] rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
      </div>

      {/* Trainee table */}
      <section className="mt-6">
        {filteredRows.length === 0 ? (
          <EmptyState illustration={<GrowthPathDoodle className="h-full w-full" />} title="No trainees match" description="Adjust the filters or search above." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-gray bg-brand-surface">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-gray text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <SortableHeader label="Trainee" sortKey="name" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableHeader label="Progress" sortKey="completionPct" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableHeader label="First" sortKey="firstScore" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableHeader label="Best" sortKey="bestScore" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableHeader label="Latest" sortKey="latestScore" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableHeader label="Average" sortKey="averageScore" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableHeader label="Attempts" sortKey="totalAttempts" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableHeader label="Passed On" sortKey="passedOnAttempt" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <th className="px-4 py-3">Trend</th>
                  <th className="px-4 py-3">Certification</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const TrendIcon = TREND_ICON[r.trend];
                  return (
                    <tr
                      key={r.traineeId}
                      onClick={() => setSelectedTraineeId(r.traineeId)}
                      className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-brand-mint/30"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-brand-ink">{r.name}</p>
                        <p className="text-xs text-gray-500">{r.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {r.completedModules}/{r.totalModules} <span className="text-xs text-gray-500">({r.completionPct}%)</span>
                      </td>
                      <td className="px-4 py-3">{pct(r.firstScore)}</td>
                      <td className="px-4 py-3">{pct(r.bestScore)}</td>
                      <td className="px-4 py-3">{pct(r.latestScore)}</td>
                      <td className="px-4 py-3">{pct(r.averageScore)}</td>
                      <td className="px-4 py-3">{r.totalAttempts}</td>
                      <td className="px-4 py-3">{r.passedOnAttempt ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Icon icon={TrendIcon} size="sm" className={TREND_COLOR[r.trend]} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={CERT_BADGE[r.certificationStatus].variant}>{CERT_BADGE[r.certificationStatus].label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE[r.overallStatus].variant}>{STATUS_BADGE[r.overallStatus].label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Module assessment drill-down */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Module Assessments</h2>
        <p className="mt-1 text-xs text-gray-500">Aggregate stats per module across every trainee in this course.</p>
        {moduleStats === null ? (
          <div className="mt-3">
            <SkeletonList rows={2} />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-brand-gray bg-brand-surface">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-gray text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Assessment</th>
                  <th className="px-4 py-3">Trainees Attempted</th>
                  <th className="px-4 py-3">Total Attempts</th>
                  <th className="px-4 py-3">Avg. Score</th>
                  <th className="px-4 py-3">Pass Rate</th>
                </tr>
              </thead>
              <tbody>
                {moduleStats.map((m) => (
                  <tr key={m.moduleId} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-semibold text-brand-ink">{m.moduleTitle}</td>
                    <td className="px-4 py-3">{m.hasAssessment ? <Badge variant="neutral">Configured</Badge> : <Badge variant="warning">Not configured</Badge>}</td>
                    <td className="px-4 py-3">{m.hasAssessment ? m.distinctTraineesAttempted : "—"}</td>
                    <td className="px-4 py-3">{m.hasAssessment ? m.totalAttempts : "—"}</td>
                    <td className="px-4 py-3">{m.hasAssessment ? pct(m.averagePercentage) : "—"}</td>
                    <td className="px-4 py-3">{m.hasAssessment ? pct(m.passRate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* At-risk */}
      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          <Icon icon={AlertTriangle} size="sm" className="text-brand-rose" /> At-Risk Trainees
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Reflects the Early Warnings thresholds set for this course. Inactivity alerts refresh when the{" "}
          <a href={`/admin/courses/${courseId}/early-warnings`} className="font-semibold text-brand-teal hover:underline">
            Early Warnings
          </a>{" "}
          page is opened.
        </p>
        {atRiskRows.length === 0 ? (
          <div className="mt-3">
            <EmptyState illustration={<GrowthPathDoodle className="h-full w-full" />} title="No at-risk trainees" description="No thresholds have been crossed for this course right now." />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {atRiskRows.map((r) => (
              <Card key={r.traineeId} className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display font-semibold text-brand-ink">{r.name}</p>
                  <p className="text-xs text-gray-500">{r.email}</p>
                  <ul className="mt-2 space-y-1 text-sm text-brand-ink">
                    {r.atRiskReasons.map((reason, i) => (
                      <li key={i}>· {reason}</li>
                    ))}
                  </ul>
                </div>
                <Badge variant="danger">At Risk</Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      {selectedTraineeId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 px-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedTraineeId(null)}
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-brand-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <SkeletonList rows={3} />
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg font-semibold text-brand-ink">{detail.name}</p>
                    <p className="text-xs text-gray-500">{detail.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" loading={messaging} iconLeft={<Icon icon={MessageCircle} size="sm" />} onClick={() => messageTrainee(detail.traineeId)}>
                      Message
                    </Button>
                    {isSuperAdmin && (
                      <Button size="sm" variant="danger" onClick={() => setSuspendModalOpen(true)}>
                        Suspend
                      </Button>
                    )}
                    <button onClick={() => setSelectedTraineeId(null)} aria-label="Close">
                      <Icon icon={X} size="md" className="text-gray-400 hover:text-brand-ink" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant={CERT_BADGE[detail.certificationStatus].variant}>{CERT_BADGE[detail.certificationStatus].label}</Badge>
                  <Badge variant="neutral">
                    {detail.completedModules}/{detail.totalModules} modules ({detail.completionPct}%)
                  </Badge>
                  {detail.isAtRisk && <Badge variant="danger">At Risk</Badge>}
                </div>

                {detail.attempts.length === 0 ? (
                  <p className="mt-6 text-sm text-gray-500">No submitted assessment attempts yet.</p>
                ) : (
                  <>
                    <div className="mt-6 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: -12 }}>
                          <CartesianGrid stroke="#E4EEE7" strokeDasharray="3 3" />
                          <XAxis dataKey="index" stroke="#6B7280" fontSize={11} tickLine={false} />
                          <YAxis domain={[0, 100]} stroke="#6B7280" fontSize={11} tickLine={false} />
                          <Tooltip formatter={(value: number | string) => (value == null ? "—" : `${value}%`)} labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""} />
                          <Legend />
                          {referenceMark != null && <ReferenceLine y={referenceMark} stroke="#9CA3AF" strokeDasharray="4 4" label={{ value: "Pass mark", fontSize: 10, fill: "#9CA3AF" }} />}
                          <Line type="monotone" dataKey="module" name="Module Assessments" stroke="#016B61" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                          <Line type="monotone" dataKey="courseExam" name="Course Examination" stroke="#D99A34" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-brand-gray font-semibold uppercase tracking-wide text-gray-500">
                            <th className="py-2 pr-3">Assessment</th>
                            <th className="py-2 pr-3">Attempt</th>
                            <th className="py-2 pr-3">Score</th>
                            <th className="py-2 pr-3">Result</th>
                            <th className="py-2 pr-3">Submitted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.attempts.map((a, i) => (
                            <tr key={i} className="border-b border-gray-100 last:border-0">
                              <td className="py-2 pr-3">{a.examTitle}</td>
                              <td className="py-2 pr-3">{a.attemptNumber}</td>
                              <td className="py-2 pr-3">{pct(a.percentage)}</td>
                              <td className="py-2 pr-3">{a.passed ? "Pass" : "Fail"}</td>
                              <td className="py-2 pr-3">{a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {detail.isAtRisk && <div className="mt-4 rounded-lg bg-brand-roseLight px-3 py-2 text-xs text-brand-rose">{detail.atRiskReasons.join(" · ")}</div>}
              </>
            )}
          </div>
        </div>
      )}

      {detail && (
        <SuspendReasonModal open={suspendModalOpen} traineeName={detail.name} onCancel={() => setSuspendModalOpen(false)} onConfirm={confirmSuspendTrainee} />
      )}
    </>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: 1 | -1;
  onClick: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th className="cursor-pointer select-none px-4 py-3 hover:text-brand-teal" onClick={() => onClick(sortKey)}>
      {label} {active && (dir === 1 ? "↑" : "↓")}
    </th>
  );
}
