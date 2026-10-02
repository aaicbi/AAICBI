"use client";
import NotificationBell from "@/components/NotificationBell";

// Instructor Portal, Phase 1 — an INSTRUCTOR is still a `User` (staff)
// row, so it logs back in through the same staff form as admin, not a
// separate instructor login page. Same shape as admin/investor's own
// LogoutButton — see their comments.
//
// Sidebar rollout (Phase 2) — this now renders only inside
// InstructorSidebar.tsx (SiteHeader is suppressed on every other
// authenticated instructor page), so align="left"/justify-between
// match that narrow sidebar row instead of the old wide top bar.
export default function LogoutButton() {
  return (
    <div className="flex items-center justify-between">
      <NotificationBell align="left" />
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          // Bug fix — see trainee/LogoutButton.tsx's own comment: a
          // hard navigation (not router.push) is required so
          // admin/layout.tsx's server-side session check (the layout
          // /admin/login itself falls under) actually re-runs instead
          // of leaving a stale instructor sidebar mounted over it.
          window.location.href = "/admin/login";
        }}
        className="rounded-lg border border-brand-gray px-3 py-2.5 text-sm font-semibold text-gray-600 hover:border-brand-teal"
      >
        Log out
      </button>
    </div>
  );
}
