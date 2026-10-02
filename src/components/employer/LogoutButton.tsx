"use client";
import NotificationBell from "@/components/NotificationBell";

// Same reasoning as the trainee version of this component — see its
// own comment.
//
// Sidebar rollout (Phase 2) — this now renders only inside
// EmployerSidebar.tsx (SiteHeader is suppressed on every other
// authenticated employer page), so align="left"/justify-between match
// that narrow sidebar row instead of the old wide top bar.
export default function LogoutButton() {
  return (
    <div className="flex items-center justify-between">
      <NotificationBell align="left" />
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          // Bug fix — see trainee/LogoutButton.tsx's own comment: a
          // hard navigation (not router.push) is required so the
          // shared employer/layout.tsx server-side session check
          // actually re-runs instead of leaving a stale sidebar
          // mounted over the login form.
          window.location.href = "/employer/login";
        }}
        className="rounded-lg border border-brand-gray px-3 py-2.5 text-sm font-semibold text-gray-600 hover:border-brand-teal"
      >
        Log out
      </button>
    </div>
  );
}
