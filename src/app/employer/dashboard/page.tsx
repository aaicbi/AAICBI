import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getTimeOfDayGreeting, formatLastVisit } from "@/lib/dashboardHelpers";
import { getRecentNotifications, getUnreadNotificationCount, getEventsSinceLastVisit } from "@/lib/dashboard/recentNotifications";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/employer/LogoutButton";
import Card from "@/components/ui/Card";
import WelcomeHeader from "@/components/dashboard/WelcomeHeader";
import NotificationSummaryCard from "@/components/dashboard/NotificationSummaryCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import QuickActionsCard from "@/components/dashboard/QuickActionsCard";

const NAV = [
  { label: "Discover", href: "/employer/discover" },
  { label: "My Introductions", href: "/employer/introductions" },
  { label: "Job Postings", href: "/employer/job-postings" },
  { label: "My Profile", href: "/employer/profile" },
  { label: "Account", href: "/employer/status" },
  { label: "Settings", href: "/employer/settings" },
];

/**
 * Personalized landing page — the employer's new post-login landing
 * page. No employer dashboard existed before this; employers landed on
 * /employer/status (an approval-status page, kept fully intact and
 * still the canonical destination for a not-yet-approved account — a
 * PENDING/REJECTED employer is redirected there rather than seeing a
 * half-working dashboard for features they can't use yet).
 */
export default async function EmployerDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "EMPLOYER") {
    redirect("/employer/login");
  }

  const employer = await prisma.employer.findUnique({ where: { id: session.userId } });
  if (!employer) redirect("/employer/login");
  if (employer.approvalState !== "APPROVED") redirect("/employer/status");

  const [notifications, unreadCount, sinceLastVisit, pendingIntroductions, activeVacancies] = await Promise.all([
    getRecentNotifications("EMPLOYER", session.userId, 5),
    getUnreadNotificationCount("EMPLOYER", session.userId),
    getEventsSinceLastVisit("EMPLOYER", session.userId, employer.previousLoginAt, 10),
    prisma.introductionRequest.count({ where: { employerId: session.userId, status: "PENDING" } }),
    prisma.jobPosting.count({ where: { employerId: session.userId, status: "APPROVED" } }),
  ]);

  const quickActions = [
    { label: "Discover Trainees", href: "/employer/discover" },
    { label: "My Introductions", href: "/employer/introductions" },
    { label: "Job Postings", href: "/employer/job-postings" },
    { label: "My Profile", href: "/employer/profile" },
  ];

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <WelcomeHeader
          greeting={getTimeOfDayGreeting()}
          name={employer.companyName}
          avatarUrl={employer.logoUrl}
          roleLabel="Employer"
          statusLabel="Active"
          statusVariant="success"
          lastVisitLabel={formatLastVisit(employer.previousLoginAt)}
          profileHref="/employer/profile"
        />

        {(pendingIntroductions > 0 || activeVacancies > 0) && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Card>
              <p className="text-2xl font-semibold text-brand-ink">{pendingIntroductions}</p>
              <p className="text-xs text-gray-500">Pending introduction{pendingIntroductions === 1 ? "" : "s"}</p>
            </Card>
            <Card>
              <p className="text-2xl font-semibold text-brand-ink">{activeVacancies}</p>
              <p className="text-xs text-gray-500">Active job posting{activeVacancies === 1 ? "" : "s"}</p>
            </Card>
          </div>
        )}

        <NotificationSummaryCard notifications={notifications} unreadCount={unreadCount} />
        <ActivityFeed
          mode={employer.previousLoginAt ? "since-last-visit" : "recent"}
          events={employer.previousLoginAt ? sinceLastVisit : notifications}
        />
        <QuickActionsCard actions={quickActions} />
      </main>
    </>
  );
}
