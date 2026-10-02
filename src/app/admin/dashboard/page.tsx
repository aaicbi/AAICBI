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
import Button from "@/components/ui/Button";
import WelcomeHeader from "@/components/dashboard/WelcomeHeader";
import NotificationSummaryCard from "@/components/dashboard/NotificationSummaryCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import QuickActionsCard from "@/components/dashboard/QuickActionsCard";
import { ADMIN_NAV } from "@/lib/admin/nav";

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
  // Admin Dashboard & Examinations redesign (Phase 2) — the full exam
  // list (with per-exam question/attempt counts) moved to its own index
  // page, /admin/exams (same createdByFilter scoping, same query shape,
  // just relocated). The dashboard only needs the totals for a compact
  // summary now, not every row.
  const [staff, examCount, publishedExamCount, notifications, unreadCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.userId } }),
    prisma.exam.count({ where: createdByFilter(session) }),
    prisma.exam.count({ where: { ...createdByFilter(session), published: true } }),
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

  // Admin Dashboard & Examinations redesign (Phase 2) — curated into a
  // primary/secondary split so the shared QuickActionsCard's own
  // expand/collapse (built for the trainee dashboard, reused here
  // unchanged) actually does something: previously every item here left
  // `primary` unset, which QuickActionsCard treats as "always visible,"
  // so a SUPER_ADMIN's up-to-15-item list rendered flat with no "Show
  // more" toggle at all. The 5 most commonly used actions stay primary;
  // everything else — including the full ADMIN_AREAS list, which can
  // run to 8 items on its own — sits behind the toggle.
  const quickActions = [
    { label: "Create Examination", href: "/admin/exams/new", primary: true },
    { label: "Courses", href: "/admin/courses", primary: true },
    { label: "Performance", href: "/admin/performance", primary: true },
    { label: "Analytics", href: "/admin/analytics", primary: true },
    { label: "Messages", href: "/admin/messages", primary: true },
    { label: "My Profile", href: "/admin/profile", primary: false },
    // AI Command Center — genuinely SUPER_ADMIN only (unlike the
    // isApprover-gated items below, which ADMIN can also use), server-
    // checked here rather than fetched client-side, so there's no risk
    // of a wrong role briefly seeing a link that will 403 for them.
    // Nav items are plain-text labels (SiteHeader's NavItem has no icon
    // slot) — dropped the emoji prefix rather than widen that shared
    // component's API for the one nav item that had one.
    ...(session.role === "SUPER_ADMIN" ? [{ label: "Ask Loop (Command)", href: "/admin/command", primary: false }] : []),
    ...(isApprover ? ADMIN_AREAS.map((a) => ({ label: a.label, href: a.href, primary: false })) : []),
  ];

  return (
    <>
      <SiteHeader nav={ADMIN_NAV} right={<LogoutButton />} />
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
              <Card interactive variant="highlighted">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Pending</p>
                <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{pendingEmployers}</p>
                <p className="text-xs text-gray-500">Employer{pendingEmployers === 1 ? "" : "s"}</p>
              </Card>
            </Link>
            <Link href="/admin/job-postings">
              <Card interactive variant="highlighted">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">To Review</p>
                <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{pendingJobPostings}</p>
                <p className="text-xs text-gray-500">Job posting{pendingJobPostings === 1 ? "" : "s"}</p>
              </Card>
            </Link>
            <Link href="/admin/reports">
              <Card interactive variant="highlighted">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Flagged</p>
                <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{pendingReports}</p>
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

        {/* Admin Dashboard & Examinations redesign (Phase 2) — a
            compact summary in place of the full inline exam list that
            used to live here. The dashboard is a personal landing page,
            not the exams index; the real index (same data, same
            per-exam Questions/Results links, same createdByFilter
            scoping) is now /admin/exams, which "Examinations" in the
            top nav actually points at. */}
        <Card className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Examinations</p>
            <p className="mt-1 font-display text-xl font-semibold text-brand-ink">
              {examCount} examination{examCount === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">
              {publishedExamCount} published{examCount > publishedExamCount ? `, ${examCount - publishedExamCount} draft` : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button href="/admin/exams" variant="secondary">
              View All
            </Button>
            <Button href="/admin/exams/new">+ Create Examination</Button>
          </div>
        </Card>
      </main>
    </>
  );
}
