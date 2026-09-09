import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import SiteHeader from "@/components/SiteHeader";
import TraineeLogoutButton from "@/components/trainee/LogoutButton";
import EmployerLogoutButton from "@/components/employer/LogoutButton";
import AdminLogoutButton from "@/components/admin/LogoutButton";
import NotificationsList from "./NotificationsList";

const NAV_BY_ROLE: Record<string, { label: string; href: string }[]> = {
  TRAINEE: [
    { label: "Dashboard", href: "/trainee/dashboard" },
    { label: "Courses", href: "/trainee/courses" },
    { label: "My Profile", href: "/trainee/profile" },
    { label: "Settings", href: "/trainee/settings" },
  ],
  EMPLOYER: [
    { label: "Dashboard", href: "/employer/dashboard" },
    { label: "Discover", href: "/employer/discover" },
    { label: "My Profile", href: "/employer/profile" },
    { label: "Settings", href: "/employer/settings" },
  ],
  STAFF: [
    { label: "Examinations", href: "/admin/dashboard" },
    { label: "Courses", href: "/admin/courses" },
    { label: "My Profile", href: "/admin/profile" },
    { label: "Settings", href: "/admin/settings" },
  ],
};

/**
 * Personalized landing page — the "View All Notifications" destination
 * from each dashboard's summary card, and from the header bell's own
 * eventual full-list link. Role-agnostic on purpose (reads the caller's
 * session directly, same recipientType resolution GET
 * /api/notifications already uses) rather than three near-identical
 * pages, since notifications are the one thing every role genuinely
 * shares. A server component for the initial data (consistent with
 * this app's dashboard pages), handing off to a small client
 * component only for the interactive mark-read actions.
 */
export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <p className="text-sm text-gray-600">Please sign in to view your notifications.</p>
        </main>
      </>
    );
  }

  const recipientType = session.role === "TRAINEE" ? "TRAINEE" : session.role === "EMPLOYER" ? "EMPLOYER" : "STAFF";
  const notifications = await prisma.userNotification.findMany({
    where: { recipientType, recipientId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const nav = NAV_BY_ROLE[recipientType];
  const logoutButton =
    recipientType === "TRAINEE" ? <TraineeLogoutButton /> : recipientType === "EMPLOYER" ? <EmployerLogoutButton /> : <AdminLogoutButton />;

  return (
    <>
      <SiteHeader nav={nav} right={logoutButton} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Notifications</h1>
        <NotificationsList
          initialNotifications={notifications.map((n: (typeof notifications)[number]) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            url: n.url,
            readAt: n.readAt ? n.readAt.toISOString() : null,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      </main>
    </>
  );
}
