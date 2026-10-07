import Link from "next/link";
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

  const [
    notifications,
    unreadCount,
    sinceLastVisit,
    pendingIntroductions,
    activeVacancies,
    acceptedIntroductions,
    postingsInReview,
    applicationsReceived,
  ] = await Promise.all([
    getRecentNotifications("EMPLOYER", session.userId, 5),
    getUnreadNotificationCount("EMPLOYER", session.userId),
    getEventsSinceLastVisit("EMPLOYER", session.userId, employer.previousLoginAt, 10),
    prisma.introductionRequest.count({ where: { employerId: session.userId, status: "PENDING" } }),
    prisma.jobPosting.count({ where: { employerId: session.userId, status: "APPROVED" } }),
    prisma.introductionRequest.count({ where: { employerId: session.userId, status: "ACCEPTED" } }),
    prisma.jobPosting.count({ where: { employerId: session.userId, status: "PENDING_REVIEW" } }),
    prisma.jobApplication.count({ where: { jobPosting: { employerId: session.userId } } }),
  ]);

  // One suggested next step, chosen from the real state of the pipeline,
  // so the dashboard answers "what should I do now" and not only "what
  // are the numbers".
  const nextStep =
    acceptedIntroductions > 0
      ? { text: `${acceptedIntroductions} trainee${acceptedIntroductions === 1 ? " has" : "s have"} accepted your introduction. Follow up with them.`, label: "Open introductions", href: "/employer/introductions" }
      : applicationsReceived > 0
        ? { text: `You have ${applicationsReceived} application${applicationsReceived === 1 ? "" : "s"} to review.`, label: "Review postings", href: "/employer/job-postings" }
        : activeVacancies === 0 && postingsInReview === 0
          ? { text: "You have no job postings yet. Post a vacancy to start receiving applications.", label: "Post a vacancy", href: "/employer/job-postings" }
          : pendingIntroductions === 0
            ? { text: "Browse trainees with verified certificates and send an introduction.", label: "Discover trainees", href: "/employer/discover" }
            : { text: "Your introductions are waiting for trainees to reply.", label: "View introductions", href: "/employer/introductions" };

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

        <section aria-labelledby="pipeline" className="mt-6">
          <h2 id="pipeline" className="font-display text-base font-semibold text-brand-ink">
            Your hiring pipeline
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile value={pendingIntroductions} label="Introductions awaiting reply" href="/employer/introductions" />
            <Tile value={acceptedIntroductions} label="Introductions accepted" href="/employer/introductions" />
            <Tile value={activeVacancies} label={`Active posting${activeVacancies === 1 ? "" : "s"}`} href="/employer/job-postings" />
            <Tile value={applicationsReceived} label={`Application${applicationsReceived === 1 ? "" : "s"} received`} href="/employer/job-postings" />
          </div>
          {postingsInReview > 0 && (
            <p className="mt-2 text-xs text-gray-600">
              {postingsInReview} posting{postingsInReview === 1 ? " is" : "s are"} waiting for AAICBI review.
            </p>
          )}
          <Card variant="highlighted" className="mt-3">
            <p className="text-sm text-brand-ink">{nextStep.text}</p>
            <Link href={nextStep.href} className="mt-2 inline-block text-sm font-semibold text-brand-teal hover:underline">
              {nextStep.label}
            </Link>
          </Card>
        </section>

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

function Tile({ value, label, href }: { value: number; label: string; href: string }) {
  return (
    <Link href={href} className="block rounded-xl border border-brand-gray bg-brand-surface p-4 hover:border-brand-teal">
      <p className="font-display text-3xl font-semibold tabular-nums text-brand-ink">{value}</p>
      <p className="mt-0.5 text-xs text-gray-600">{label}</p>
    </Link>
  );
}
