"use client";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import QuickActionsNavMenu from "@/components/trainee/QuickActionsNavMenu";

// M32/Stage 6 audit — the bell renders here, not on every individual
// page, since this component already renders on every trainee page in
// the app via each page's own `right={<LogoutButton />}` prop. Adding
// it here means every trainee page gets a real, always-visible
// notification bell "for free," matching the same reach LogoutButton
// itself already has, rather than needing dozens of individual page
// edits to achieve the same coverage.
//
// Dashboard/Examination redesign — QuickActionsNavMenu rides the same
// mechanism for the same reason: one addition here reaches every
// trainee page instead of threading a new prop through dozens of them.
export default function LogoutButton() {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <QuickActionsNavMenu />
      <NotificationBell />
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/trainee/login");
        }}
        className="rounded-lg border border-brand-gray px-3 py-2.5 text-sm font-semibold text-gray-600 hover:border-brand-teal"
      >
        Log out
      </button>
    </div>
  );
}
