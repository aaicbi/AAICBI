import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { createdByFilter } from "@/lib/courseOwnership";
import { getTimeOfDayGreeting, formatLastVisit } from "@/lib/dashboardHelpers";
import { getRecentNotifications, getUnreadNotificationCount, getEventsSinceLastVisit } from "@/lib/dashboard/recentNotifications";
import { ADMIN_AREAS } from "@/lib/adminAreas";
import LogoutButton from "@/components/admin/LogoutButton";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import WelcomeHeader from "@/components/dashboard/WelcomeHeader";
import NotificationSummaryCard from "@/components/dashboard/NotificationSummaryCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import QuickActionsCard from "@/components/dashboard/QuickActionsCard";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
};

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

export default async function AdminDashboardPage() {
  // Bug fix — this used to call requireRole(...) directly, which
  // THROWS a plain Error for the wrong role rather than redirecting.
  // That's the right shape for an API route (withApiErrors turns it
  // into a clean 403 JSON response), but this is a page component with
  // no such wrapper: the throw became an uncaught exception, and
  // Next.js's generic error boundary rendered a raw 500 for something
  // that should have been a quiet redirect — e.g. a trainee with a
  // valid session who lands on /admin/dashboard (middleware only
  // checks "is there a session," not which role, so this really can
  // happen). Same getSession()-then-redirect() pattern already used by
  // /trainee/dashboard and /employer/dashboard.
  const session = await getSession();
  if (!session || !ALLOWED_ROLES.includes(session.role)) {
    redirect("/admin/login");
  }
  // Audit finding, closed here: this was a bare `{ createdById:
  // session.userId }`, meaning even a SUPER_ADMIN only ever saw their
  // own exams here — the one genuine inconsistency with the
  // established, deliberate pattern this project already uses
  // everywhere else a staff list route needs this exact distinction
  // (see /api/courses's own use of the same helper, and
  // createdByFilter's own comment for the full reasoning: SUPER_ADMIN
  // sees everything on a list/GET route, narrowly scoped to visibility
  // only, never a bypass on anything that modifies data).
  const [staff, exams, notifications, unreadCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.userId } }),
    prisma.exam.findMany({
      where: createdByFilter(session),
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { questions: true, attempts: true } } },
    }),
    getRecentNotifications("STAFF", session.userId, 5),
    getUnreadNotificationCount("STAFF", session.userId),
  ]);
  const sinceLastVisit = await getEventsSinceLastVisit("STAFF", session.userId, staff.previousLoginAt, 10);

  // Personalized landing page — "pending approvals" a SUPER_ADMIN/ADMIN
  // can actually act on, real counts only (never shown for INSTRUCTOR,
  // which has no approval authority anywhere else in this app either).
  const isApprover = session.role === "SUPER_ADMIN" || session.role === "ADMIN";
  const [pendingEmployers, pendingJobPostings, pendingReports] = isApprover
    ? await Promise.all([
        prisma.employer.count({ where: { approvalState: "PENDING" } }),
        prisma.jobPosting.count({ where: { status: "PENDING_REVIEW" } }),
        prisma.profileReport.count({ where: { status: "PENDING" } }),
      ])
    : [0, 0, 0];

  const quickActions = [
    { label: "Create Examination", href: "/admin/exams/new" },
    { label: "Courses", href: "/admin/courses" },
    { label: "Performance", href: "/admin/performance" },
    { label: "My Profile", href: "/admin/profile" },
    // AI Command Center — genuinely SUPER_ADMIN only (unlike the
    // isApprover-gated items below, which ADMIN can also use), server-
    // checked here rather than fetched client-side, so there's no risk
    // of a wrong role briefly seeing a link that will 403 for them.
    // Nav items are plain-text labels (SiteHeader's NavItem has no icon
    // slot) — dropped the emoji prefix rather than widen that shared
    // component's API for the one nav item that had one.
    ...(session.role === "SUPER_ADMIN" ? [{ label: "Ask Loop (Command)", href: "/admin/command" }] : []),
    ...(isApprover ? ADMIN_AREAS.map((a) => ({ label: a.label, href: a.href })) : []),
  ];

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Courses", href: "/admin/courses" },
          { label: "Performance", href: "/admin/performance" },
          { label: "Payments", href: "/admin/payments" },
          { label: "My Profile", href: "/admin/profile" },
          { label: "Settings", href: "/admin/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <WelcomeHeader
          greeting={getTimeOfDayGreeting()}
          name={staff.name}
          avatarUrl={staff.avatarUrl}
          username={staff.username}
          roleLabel={ROLE_LABELS[staff.role] ?? staff.role}
          statusLabel="Active"
          statusVariant="success"
          lastVisitLabel={formatLastVisit(staff.previousLoginAt)}
          profileHref="/admin/profile"
        />

        {isApprover && (pendingEmployers > 0 || pendingJobPostings > 0 || pendingReports > 0) && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Link href="/admin/employers">
              <Card interactive>
                <p className="text-2xl font-semibold text-brand-ink">{pendingEmployers}</p>
                <p className="text-xs text-gray-500">Pending employer{pendingEmployers === 1 ? "" : "s"}</p>
              </Card>
            </Link>
            <Link href="/admin/job-postings">
              <Card interactive>
                <p className="text-2xl font-semibold text-brand-ink">{pendingJobPostings}</p>
                <p className="text-xs text-gray-500">Job posting{pendingJobPostings === 1 ? "" : "s"} to review</p>
              </Card>
            </Link>
            <Link href="/admin/reports">
              <Card interactive>
                <p className="text-2xl font-semibold text-brand-ink">{pendingReports}</p>
                <p className="text-xs text-gray-500">Reported profile{pendingReports === 1 ? "" : "s"}</p>
              </Card>
            </Link>
          </div>
        )}

        <NotificationSummaryCard notifications={notifications} unreadCount={unreadCount} />
        <ActivityFeed
          mode={staff.previousLoginAt ? "since-last-visit" : "recent"}
          events={staff.previousLoginAt ? sinceLastVisit : notifications}
        />
        <QuickActionsCard actions={quickActions} />

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-brand-ink">Examinations</h2>
            <p className="text-sm text-gray-600">Signed in as {session.email}</p>
          </div>
          <Button href="/admin/exams/new">+ Create Examination</Button>
        </div>

        <div className="mt-4 space-y-3">
          {exams.length === 0 && (
            <EmptyState
              illustration={<GrowthPathDoodle className="h-full w-full" />}
              title="No examinations yet"
              description="Create one and upload a Word document to get started."
            />
          )}
          {exams.map((exam) => (
            <Card key={exam.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-display font-semibold text-brand-ink">{exam.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="font-mono">{exam.code}</span>
                  <span>{exam._count.questions} questions</span>
                  <span>{exam._count.attempts} attempts</span>
                  <Badge variant={exam.published ? "success" : "neutral"}>
                    {exam.published ? "Published" : "Draft"}
                  </Badge>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/admin/exams/${exam.id}/import`}
                  className="rounded-lg border border-brand-gray px-3 py-2 text-sm font-semibold hover:border-brand-teal"
                >
                  Questions
                </Link>
                <Link
                  href={`/admin/exams/${exam.id}/results`}
                  className="rounded-lg border border-brand-gray px-3 py-2 text-sm font-semibold hover:border-brand-teal"
                >
                  Results
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
