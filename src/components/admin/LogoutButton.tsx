"use client";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import AdminQuickActionsNavMenu from "@/components/admin/AdminQuickActionsNavMenu";

// Same reasoning as the trainee version of this component — see its
// own comment.
//
// Admin Dashboard & Examinations redesign (Phase 2) — AdminQuickActionsNavMenu
// rides the same mechanism for the same reason: one addition here
// reaches every admin page instead of threading a new prop through
// dozens of them (mirrors trainee/LogoutButton.tsx's own QuickActionsNavMenu).
export default function LogoutButton() {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <AdminQuickActionsNavMenu />
      {/* align="left" — see NotificationBell.tsx's own comment: this
          renders inside the narrow admin sidebar now, not a wide top
          bar, so the dropdown needs to expand rightward, not leftward. */}
      <NotificationBell align="left" />
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/admin/login");
        }}
        className="rounded-lg border border-brand-gray px-3 py-2.5 text-sm font-semibold text-gray-600 hover:border-brand-teal"
      >
        Log out
      </button>
    </div>
  );
}
